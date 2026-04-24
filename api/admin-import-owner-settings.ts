import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuthIpFromVercel, verifyAdminCookie } from '../server/lib/adminAuthDispatch.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { rateLimitIp } from '../server/lib/rateLimitIp.js'
import { getImportOwnerSettings, upsertImportOwnerSettings } from '../server/lib/importDb.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const ip = adminAuthIpFromVercel(req)
  if (!rateLimitIp(ip, 80, 60_000)) {
    res.status(429).json({ ok: false, error: 'rate_limited' })
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const adminOk = await verifyAdminCookie(cookieHeader)
  if (!adminOk) {
    res.status(401).json({ ok: false })
    return
  }

  if (req.method === 'GET') {
    const q = req.query.ownerUserId
    const ownerUserId = typeof q === 'string' ? q : Array.isArray(q) ? q[0] : ''
    if (!ownerUserId) {
      res.status(400).json({ ok: false, error: 'missing_owner' })
      return
    }
    const row = await getImportOwnerSettings(ownerUserId)
    if (!row) {
      res.status(503).json({ ok: false, error: 'supabase_not_configured' })
      return
    }
    res.status(200).json({ ok: true, row })
    return
  }

  if (req.method === 'POST') {
    const body = parseRequestJsonRecord(req)
    const ownerUserId = typeof body.ownerUserId === 'string' ? body.ownerUserId : ''
    const feedUrl = body.feedUrl === null || typeof body.feedUrl === 'string' ? (body.feedUrl as string | null) : null
    const rawMap = body.fieldMapping
    const fieldMapping: Record<string, string> = {}
    if (rawMap && typeof rawMap === 'object' && !Array.isArray(rawMap)) {
      for (const [k, v] of Object.entries(rawMap as Record<string, unknown>)) {
        if (typeof v === 'string' && v.trim()) fieldMapping[k] = v.trim()
      }
    }
    if (!ownerUserId.trim()) {
      res.status(400).json({ ok: false, error: 'missing_owner' })
      return
    }
    const ok = await upsertImportOwnerSettings({ ownerUserId, feedUrl, fieldMapping })
    res.status(ok ? 200 : 500).json({ ok })
    return
  }

  res.status(405).json({ ok: false })
}

