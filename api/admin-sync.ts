import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from './lib/apiSafe.js'
import { clientIp, rateLimit } from './lib/rateLimitIp.js'

type SyncBody = {
  scope?: 'owner' | 'site'
  userId?: string
  partnerId?: string
  categories?: string[]
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

  const secret = process.env.ADMIN_SYNC_SECRET?.trim()
  if (!secret) {
    res.status(503).json({ error: 'admin_sync_not_configured' })
    return
  }
  const auth = String(req.headers.authorization ?? '')
  if (auth !== `Bearer ${secret}`) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`admin-sync:${ip}`, 40, 60_000)) {
    send429(res)
    return
  }

  let body: SyncBody = {}
  try {
    const raw = req.body
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) body = raw as SyncBody
    else if (typeof raw === 'string') body = JSON.parse(raw) as SyncBody
  } catch {
    res.status(400).json({ error: 'invalid_json' })
    return
  }

  const scope = body.scope === 'site' ? 'site' : 'owner'
  const cats = Array.isArray(body.categories)
    ? body.categories.filter((c) => c === 'accommodation' || c === 'car' || c === 'motorcycle')
    : []

  res.status(200).json({
    ok: true,
    requestId: `api-${Date.now()}`,
    scope,
    userId: body.userId ?? null,
    partnerId: body.partnerId ?? null,
    categories: cats,
    note: 'Stub: stvarna sinhronizacija ide preko pozadinskog joba / partner API.',
  })
}
