import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sendSafe500, send429 } from './lib/apiSafe.js'
import { clientIp, rateLimit } from './lib/rateLimitIp.js'
import { sendTransactionalEmail } from './lib/sendBrevoMail.js'

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
  if (!rateLimit(`inq:burst:${ip}`, 4, 60_000) || !rateLimit(`inq:hour:${ip}`, 20, 3_600_000)) {
    send429(res)
    return
  }

  try {
    const raw = req.body
    const body =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : typeof raw === 'string'
          ? (JSON.parse(raw) as Record<string, unknown>)
          : {}

    const toEmail = String(body?.toEmail ?? '')
      .trim()
      .toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      res.status(400).json({ error: 'invalid_toEmail' })
      return
    }

    const listingTitle = String(body?.listingTitle ?? '').trim().slice(0, 500)
    const listingId = String(body?.listingId ?? '').trim().slice(0, 200)
    const guestFirst = String(body?.guestFirst ?? '').trim().slice(0, 120)
    const guestLast = String(body?.guestLast ?? '').trim().slice(0, 120)
    const guestEmail = String(body?.guestEmail ?? '').trim().slice(0, 200)
    const guestPhone = String(body?.guestPhone ?? '').trim().slice(0, 80)
    const period = String(body?.period ?? '').trim().slice(0, 200)
    const guests = String(body?.guests ?? '').trim().slice(0, 40)
    const message = String(body?.message ?? '').trim().slice(0, 8000)

    if (!listingTitle || !message) {
      res.status(400).json({ error: 'missing_fields' })
      return
    }

    const html = `
      <p>Novi upit preko <strong>RentAdria</strong> — „Kontaktirajte vlasnika“.</p>
      <p><strong>Oglas:</strong> ${escapeHtml(listingTitle)} <span style="color:#666">(${escapeHtml(listingId)})</span></p>
      <p><strong>Posjetilac:</strong> ${escapeHtml(guestFirst)} ${escapeHtml(guestLast)}<br/>
      Email: ${escapeHtml(guestEmail)}<br/>
      Telefon: ${escapeHtml(guestPhone)}</p>
      <p><strong>Period:</strong> ${escapeHtml(period)} &nbsp; <strong>Gosti:</strong> ${escapeHtml(guests)}</p>
      <p><strong>Poruka:</strong></p>
      <pre style="white-space:pre-wrap;font-family:inherit;border-left:3px solid #2a6edb;padding-left:12px">${escapeHtml(message)}</pre>
    `

    await sendTransactionalEmail({
      to: toEmail,
      toName: toEmail.split('@')[0] || 'Vlasnik',
      subject: `Novi upit: ${listingTitle}`,
      html,
    })

    res.status(200).json({ ok: true })
  } catch (e) {
    sendSafe500(res, e, 'notify-owner-inquiry')
  }
}
