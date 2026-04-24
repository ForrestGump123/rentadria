import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuthIpFromVercel, verifyAdminCookie } from '../server/lib/adminAuthDispatch.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { rateLimitIp } from '../server/lib/rateLimitIp.js'
import { deleteSyncPartner, listSyncPartners, upsertSyncPartner } from '../server/lib/importDb.js'

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
    const rows = await listSyncPartners()
    if (rows === null) {
      res.status(503).json({ ok: false, error: 'supabase_not_configured' })
      return
    }
    res.status(200).json({ ok: true, rows })
    return
  }

  if (req.method === 'POST') {
    const body = parseRequestJsonRecord(req)
    const raw = body.partner
    if (!raw || typeof raw !== 'object') {
      res.status(400).json({ ok: false, error: 'invalid_body' })
      return
    }
    const o = raw as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : ''
    const name = typeof o.name === 'string' ? o.name : ''
    const baseUrl = typeof o.baseUrl === 'string' ? o.baseUrl : ''
    const apiKey = typeof o.apiKey === 'string' ? o.apiKey : undefined
    const categories =
      o.categories && typeof o.categories === 'object' && !Array.isArray(o.categories)
        ? (o.categories as Record<'accommodation' | 'car' | 'motorcycle', boolean>)
        : { accommodation: true, car: true, motorcycle: true }
    if (!id || !name.trim() || !baseUrl.trim()) {
      res.status(400).json({ ok: false, error: 'invalid_partner' })
      return
    }
    const ok = await upsertSyncPartner({ id, name, baseUrl, apiKey, categories })
    res.status(ok ? 200 : 500).json({ ok })
    return
  }

  if (req.method === 'DELETE') {
    const q = req.query.id
    const id = typeof q === 'string' ? q : Array.isArray(q) ? q[0] : ''
    if (!id) {
      res.status(400).json({ ok: false })
      return
    }
    const ok = await deleteSyncPartner(id)
    res.status(ok ? 200 : 500).json({ ok })
    return
  }

  res.status(405).json({ ok: false })
}

