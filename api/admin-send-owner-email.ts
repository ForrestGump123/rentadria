import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { verifyAdminCookie } from '../server/lib/adminAuthDispatch.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { sendTransactionalEmail } from '../server/lib/sendBrevoMail.js'

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
  if (!rateLimit(`admin-send-owner-email:${ip}`, 25, 60_000)) {
    send429(res)
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const adminOk = await verifyAdminCookie(cookieHeader)
  if (!adminOk) {
    res.status(401).json({ ok: false })
    return
  }

  try {
    const body = parseRequestJsonRecord(req)
    const toEmail = String(body?.toEmail ?? '').trim().toLowerCase()
    const toName = String(body?.toName ?? '').trim().slice(0, 140)
    const subject = String(body?.subject ?? '').trim().slice(0, 200)
    const message = String(body?.message ?? '').trim().slice(0, 10_000)

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      res.status(400).json({ ok: false, error: 'invalid_toEmail' })
      return
    }
    if (!subject || !message) {
      res.status(400).json({ ok: false, error: 'missing_fields' })
      return
    }

    const html = `<p>Zdravo${toName ? ` ${escapeHtml(toName)}` : ''},</p>
<p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>
<hr/>
<p style="color:#666;font-size:12px">Poslato preko RentAdria admin panela.</p>`

    await sendTransactionalEmail({
      to: toEmail,
      toName: toName || toEmail.split('@')[0] || toEmail,
      subject,
      html,
    })

    res.status(200).json({ ok: true })
  } catch {
    res.status(400).json({ ok: false, error: 'bad_request' })
  }
}

