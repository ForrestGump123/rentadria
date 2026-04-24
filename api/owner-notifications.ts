import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { ownerUserIdFromCookie } from '../server/lib/ownerSessionAuth.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { listOwnerNotifications, markOwnerNotificationRead } from '../server/lib/ownerNotificationsDb.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`owner-notifications:${ip}`, 80, 60_000)) {
    send429(res)
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const ownerUid = await ownerUserIdFromCookie(cookieHeader)
  if (!ownerUid) {
    res.status(401).json({ ok: false, error: 'owner_auth_required' })
    return
  }

  try {
    if (req.method === 'GET') {
      const lim = Number(req.query?.limit) || 50
      const rows = await listOwnerNotifications(ownerUid, lim)
      if (rows === null) {
        res.status(503).json({ ok: false, error: 'owner_backend_unavailable' })
        return
      }
      res.status(200).json({ ok: true, notifications: rows })
      return
    }

    if (req.method === 'POST') {
      const body = parseRequestJsonRecord(req)
      const id = String(body?.id ?? '').trim()
      if (!id) {
        res.status(400).json({ ok: false, error: 'missing_id' })
        return
      }
      const ok = await markOwnerNotificationRead(ownerUid, id)
      if (!ok) {
        res.status(503).json({ ok: false, error: 'owner_backend_unavailable' })
        return
      }
      res.status(200).json({ ok: true })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch {
    res.status(400).json({ ok: false, error: 'bad_request' })
  }
}

