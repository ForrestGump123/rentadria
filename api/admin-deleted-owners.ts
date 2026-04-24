import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { verifyAdminCookie } from '../server/lib/adminAuthDispatch.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { listDeletedOwners, restoreDeletedOwner, softDeleteOwner } from '../server/lib/deletedOwnersDb.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`admin-deleted-owners:${ip}`, 80, 60_000)) {
    send429(res)
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const ok = await verifyAdminCookie(cookieHeader)
  if (!ok) {
    res.status(401).json({ ok: false })
    return
  }

  try {
    if (req.method === 'GET') {
      const rows = await listDeletedOwners()
      if (rows === null) {
        res.status(503).json({ ok: false, error: 'no_backend' })
        return
      }
      res.status(200).json({ ok: true, owners: rows })
      return
    }

    if (req.method === 'POST') {
      const body = parseRequestJsonRecord(req)
      const action = String(body?.action ?? '').trim()
      const userId = String(body?.userId ?? '').trim().toLowerCase()
      if (!userId) {
        res.status(400).json({ ok: false, error: 'missing_userId' })
        return
      }
      if (action === 'restore') {
        const ok2 = await restoreDeletedOwner(userId)
        res.status(ok2 ? 200 : 503).json({ ok: ok2 })
        return
      }
      if (action === 'delete') {
        const ok2 = await softDeleteOwner(userId)
        res.status(ok2 ? 200 : 503).json({ ok: ok2 })
        return
      }
      res.status(400).json({ ok: false, error: 'invalid_action' })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch {
    res.status(400).json({ ok: false, error: 'bad_request' })
  }
}

