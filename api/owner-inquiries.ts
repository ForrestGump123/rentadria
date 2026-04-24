import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { ownerUserIdFromCookie } from '../server/lib/ownerSessionAuth.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { clearOwnerUnread, listInquiriesForOwner } from '../server/lib/visitorInquiriesDb.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`owner-inquiries:${ip}`, 100, 60_000)) {
    send429(res)
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const ownerUid = await ownerUserIdFromCookie(cookieHeader)
  if (!ownerUid) {
    res.status(401).json({ ok: false, error: 'owner_auth_required' })
    return
  }

  if (req.method === 'GET') {
    const rows = await listInquiriesForOwner(ownerUid)
    if (rows === null) {
      res.status(503).json({ ok: false, error: 'owner_backend_unavailable' })
      return
    }
    res.status(200).json({ ok: true, inquiries: rows })
    return
  }

  if (req.method === 'POST') {
    // action: clear_unread
    const ok = await clearOwnerUnread(ownerUid)
    res.status(ok ? 200 : 503).json({ ok })
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}

