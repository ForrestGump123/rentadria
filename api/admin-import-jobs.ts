import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuthIpFromVercel, verifyAdminCookie } from '../server/lib/adminAuthDispatch.js'
import { rateLimitIp } from '../server/lib/rateLimitIp.js'
import { listSyncJobs } from '../server/lib/importDb.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const ip = adminAuthIpFromVercel(req)
  if (!rateLimitIp(ip, 120, 60_000)) {
    res.status(429).json({ ok: false, error: 'rate_limited' })
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const adminOk = await verifyAdminCookie(cookieHeader)
  if (!adminOk) {
    res.status(401).json({ ok: false })
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false })
    return
  }

  const q = req.query.limit
  const limit = typeof q === 'string' ? Math.max(1, Math.min(80, parseInt(q, 10) || 30)) : 30
  const rows = await listSyncJobs(limit)
  if (rows === null) {
    res.status(503).json({ ok: false, error: 'supabase_not_configured' })
    return
  }
  res.status(200).json({ ok: true, rows })
}

