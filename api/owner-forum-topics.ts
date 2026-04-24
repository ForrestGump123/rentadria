import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { ownerUserIdFromCookie } from '../server/lib/ownerSessionAuth.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { createForumTopic, listForumTopics } from '../server/lib/ownerForumDb.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`owner-forum-topics:${ip}`, 180, 60_000)) {
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
    const rows = await listForumTopics(200)
    if (rows === null) {
      res.status(503).json({ ok: false, error: 'owner_backend_unavailable' })
      return
    }
    res.status(200).json({ ok: true, topics: rows })
    return
  }

  if (req.method === 'POST') {
    const body = parseRequestJsonRecord(req)
    const title = String(body?.title ?? '')
    const initialBody = String(body?.body ?? '')
    const authorName = String(body?.authorName ?? '')

    const r = await createForumTopic({
      authorUserId: ownerUid,
      authorName,
      title,
      initialBody,
    })
    if (r.ok === false) {
      res.status(r.error === 'no_backend' ? 503 : 400).json({ ok: false, error: r.error })
      return
    }
    res.status(200).json({ ok: true, topicId: r.topicId })
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}

