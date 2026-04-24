import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { ownerUserIdFromCookie } from '../server/lib/ownerSessionAuth.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { appendMessage, getThreadMessages, listThreadsForOwner, markThreadSeen } from '../server/lib/ownerAdminMessagesDb.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`owner-admin-thread:${ip}`, 160, 60_000)) {
    send429(res)
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const ownerUid = await ownerUserIdFromCookie(cookieHeader)
  if (!ownerUid) {
    res.status(401).json({ ok: false, error: 'owner_auth_required' })
    return
  }

  const threadId = typeof req.query?.id === 'string' ? req.query.id.trim() : ''
  if (!threadId) {
    res.status(400).json({ ok: false, error: 'missing_id' })
    return
  }

  // Basic ownership check by listing threads for owner (fast enough for typical sizes).
  const threads = await listThreadsForOwner(ownerUid)
  if (!threads) {
    res.status(503).json({ ok: false, error: 'owner_backend_unavailable' })
    return
  }
  if (!threads.some((t) => t.id === threadId)) {
    res.status(404).json({ ok: false, error: 'not_found' })
    return
  }

  try {
    if (req.method === 'GET') {
      const messages = await getThreadMessages(threadId)
      if (messages === null) {
        res.status(503).json({ ok: false, error: 'owner_backend_unavailable' })
        return
      }
      res.status(200).json({ ok: true, messages })
      return
    }

    if (req.method === 'POST') {
      const body = parseRequestJsonRecord(req)
      const action = String(body?.action ?? '').trim()
      if (action === 'seen') {
        const ok = await markThreadSeen({ threadId, party: 'owner' })
        res.status(ok ? 200 : 503).json({ ok })
        return
      }
      const msg = String(body?.body ?? '').trim()
      const r = await appendMessage({ threadId, from: 'owner', body: msg })
      if (!r.ok) {
        res.status(r.error === 'no_backend' ? 503 : 400).json({ ok: false, error: r.error ?? 'send_failed' })
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

