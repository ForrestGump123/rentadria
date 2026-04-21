import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429, sendSafe500 } from '../server/lib/apiSafe.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { signOwnerLoginLinkToken } from '../server/lib/verifyJwt.js'
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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
  if (!rateLimit(`owner-login-link:${ip}`, 20, 60_000)) {
    send429(res)
    return
  }

  try {
    const body = parseRequestJsonRecord(req)
    const email = String(body?.email ?? '')
      .trim()
      .toLowerCase()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ ok: false, error: 'invalid_email' })
      return
    }

    const token = await signOwnerLoginLinkToken(email)
    const base = siteBase(req)
    const url = `${base}/owner-login?token=${encodeURIComponent(token)}`

    const html = `
      <p>Zdravo,</p>
      <p>Ovo je link za prijavu na <strong>RentAdria</strong> (važi 30 minuta):</p>
      <p><a href="${url}">Prijavi se</a></p>
      <p style="word-break:break-all;font-size:12px;color:#666">${escapeHtml(url)}</p>
      <p>Ako niste vi tražili prijavu, ignorišite ovu poruku.</p>
    `

    await sendTransactionalEmail({
      to: email,
      toName: '',
      subject: 'Prijava — RentAdria',
      html,
    })

    res.status(200).json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('JWT_SECRET')) {
      res.status(503).json({
        ok: false,
        error: 'jwt_secret_missing',
        hint: 'Set JWT_SECRET (min 16 characters) in Vercel Project → Settings → Environment Variables, then redeploy.',
      })
      return
    }
    if (msg.includes('missing_email_config')) {
      res.status(503).json({
        ok: false,
        error: 'email_config_missing',
        hint: 'Set BREVO_API_KEY (REST) or BREVO_SMTP_USER + BREVO_SMTP_PASS. Verify sender domain in Brevo.',
      })
      return
    }
    sendSafe500(res, e, 'owner-login-link')
  }
}

