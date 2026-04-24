import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { ownerUserIdFromCookie } from '../server/lib/ownerSessionAuth.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { addForumReply, getForumTopic } from '../server/lib/ownerForumDb.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`owner-forum-thread:${ip}`, 240, 60_000)) {
    send429(res)
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const ownerUid = await ownerUserIdFromCookie(cookieHeader)
  if (!ownerUid) {
    res.status(401).json({ ok: false, error: 'owner_auth_required' })
    return
  }

  const topicId = typeof req.query?.id === 'string' ? req.query.id.trim() : ''
  if (!topicId) {
    res.status(400).json({ ok: false, error: 'missing_id' })
    return
  }

  if (req.method === 'GET') {
    const row = await getForumTopic(topicId)
    if (row === null) {
      res.status(503).json({ ok: false, error: 'owner_backend_unavailable' })
      return
    }
    res.status(row ? 200 : 404).json({ ok: Boolean(row), topic: row ?? null })
    return
  }

  if (req.method === 'POST') {
    const body = parseRequestJsonRecord(req)
    const msg = String(body?.body ?? '')
    const authorName = String(body?.authorName ?? '')
    const r = await addForumReply({ topicId, authorUserId: ownerUid, authorName, body: msg })
    if (r.ok === false) {
      res.status(r.error === 'no_backend' ? 503 : 400).json({ ok: false, error: r.error })
      return
    }
    res.status(200).json({ ok: true })
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}

