import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { ownerUserIdFromCookie } from '../server/lib/ownerSessionAuth.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { createThread, listThreadsForOwner } from '../server/lib/ownerAdminMessagesDb.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`owner-admin-threads:${ip}`, 120, 60_000)) {
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
      const threads = await listThreadsForOwner(ownerUid)
      if (threads === null) {
        res.status(503).json({ ok: false, error: 'owner_backend_unavailable' })
        return
      }
      res.status(200).json({ ok: true, threads })
      return
    }

    if (req.method === 'POST') {
      const body = parseRequestJsonRecord(req)
      const subject = String(body?.subject ?? '').trim()
      const msg = String(body?.body ?? '').trim()
      const ownerEmail = String(body?.ownerEmail ?? '').trim()
      const r = await createThread({
        ownerUserId: ownerUid,
        ownerEmail: ownerEmail || undefined,
        subject,
        body: msg,
      })
      if (!r.ok) {
        res.status(r.error === 'no_backend' ? 503 : 400).json({ ok: false, error: r.error ?? 'create_failed' })
        return
      }
      res.status(200).json({ ok: true, threadId: r.threadId })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch {
    res.status(400).json({ ok: false, error: 'bad_request' })
  }
}

