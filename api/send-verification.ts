import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sendSafe500, send429 } from '../server/lib/apiSafe.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { signVerifyToken } from '../server/lib/verifyJwt.js'
import { sendTransactionalEmail } from '../server/lib/sendBrevoMail.js'

function siteBase(req: VercelRequest): string {
  const explicit = process.env.SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : ''
  if (/^https?:\/\//i.test(origin)) return origin.replace(/\/$/, '')
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '')}`
  const host = req.headers['x-forwarded-host'] || req.headers.host
  if (host && typeof host === 'string') {
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https'
    return `${proto}://${host.split(',')[0].trim()}`
  }
  return 'http://localhost:5173'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip = clientIp(req)
  try {
    const body = parseRequestJsonRecord(req)
    const email = String(body?.email ?? '')
      .trim()
      .toLowerCase()
    const name = String(body?.name ?? '').trim()
    const plan = String(body?.plan ?? 'basic').trim() || 'basic'
    const passwordHash = String(body?.passwordHash ?? '')
      .trim()
      .toLowerCase()
    const phone = String(body?.phone ?? '').trim().slice(0, 80)
    const countryId = String(body?.countryId ?? '').trim().toLowerCase()
    const promoCode = String(body?.promoCode ?? '').trim().slice(0, 64)

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'invalid_email' })
      return
    }
    if (!name) {
      res.status(400).json({ error: 'invalid_name' })
      return
    }
    if (!['basic', 'pro', 'agency'].includes(plan)) {
      res.status(400).json({ error: 'invalid_plan' })
      return
    }
    if (passwordHash && !/^[a-f0-9]{64}$/.test(passwordHash)) {
      res.status(400).json({ error: 'invalid_password_hash' })
      return
    }
    const allowedCountries = new Set(['al', 'ba', 'me', 'hr', 'it', 'rs', 'es'])
    if (countryId && !allowedCountries.has(countryId)) {
      res.status(400).json({ error: 'invalid_country' })
      return
    }

    if (
      !rateLimit(`reg:email:${email}`, 4, 86_400_000) ||
      !rateLimit(`reg:ip:${ip}`, 8, 3_600_000)
    ) {
      send429(res)
      return
    }

    const token = await signVerifyToken({
      email,
      name,
      plan,
      ...(passwordHash ? { passwordHash } : {}),
      ...(phone ? { phone } : {}),
      ...(countryId ? { countryId } : {}),
      ...(promoCode ? { promoCode } : {}),
    })
    const base = siteBase(req)
    const verifyUrl = `${base}/verify?token=${encodeURIComponent(token)}`

    const html = `
      <p>Zdravo${name ? ` ${escapeHtml(name)}` : ''},</p>
      <p>Hvala na registraciji na <strong>RentAdria</strong>.</p>
      <p>Kliknite na link ispod da potvrdite email adresu (važi 48 sati):</p>
      <p><a href="${verifyUrl}">Potvrdi email</a></p>
      <p style="word-break:break-all;font-size:12px;color:#666">${escapeHtml(verifyUrl)}</p>
      <p>Ako niste vi poslali ovu prijavu, ignorišite ovu poruku.</p>
    `

    await sendTransactionalEmail({
      to: email,
      toName: name,
      subject: 'Potvrdite registraciju — RentAdria',
      html,
    })

    res.status(200).json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('JWT_SECRET')) {
      res.status(503).json({
        error: 'jwt_secret_missing',
        hint: 'Set JWT_SECRET (min 16 characters) in Vercel Project → Settings → Environment Variables, then redeploy.',
      })
      return
    }
    if (msg.includes('missing_email_config')) {
      res.status(503).json({
        error: 'email_config_missing',
        hint: 'Set BREVO_API_KEY (REST) or BREVO_SMTP_USER + BREVO_SMTP_PASS. Verify sender domain in Brevo.',
      })
      return
    }
    sendSafe500(res, e, 'send-verification')
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
