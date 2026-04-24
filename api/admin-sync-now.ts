import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuthIpFromVercel, verifyAdminCookie } from '../server/lib/adminAuthDispatch.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { rateLimitIp } from '../server/lib/rateLimitIp.js'
import { insertSyncJob, listSyncPartners } from '../server/lib/importDb.js'

/**
 * Run a sync (stub) from admin panel, server-backed + logs to Supabase.
 * This replaces the old localStorage stub so it works from any device.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false })
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

  const body = parseRequestJsonRecord(req)
  const scope = body.scope === 'site' ? 'site' : 'owner'
  const ownerUserId = typeof body.userId === 'string' ? body.userId.trim().toLowerCase() : null
  const partnerId = typeof body.partnerId === 'string' ? body.partnerId : ''
  const categories = Array.isArray(body.categories)
    ? body.categories.filter((c): c is 'accommodation' | 'car' | 'motorcycle' => c === 'accommodation' || c === 'car' || c === 'motorcycle')
    : []
  const mode = body.mode === 'test' ? 'test' : 'run'

  const partners = await listSyncPartners()
  if (partners === null) {
    res.status(503).json({ ok: false, error: 'supabase_not_configured' })
    return
  }
  const partner = partners.find((p) => p.id === partnerId)
  if (!partner) {
    res.status(400).json({ ok: false, error: 'no_partner' })
    return
  }

  const cats = categories.filter((c) => partner.categories[c])
  const okCats = cats.length > 0
  const message = okCats
    ? `${mode === 'test' ? '[TEST] ' : ''}Stub sync: ${scope}${ownerUserId ? ` (${ownerUserId})` : ''} → ${partner.name} [${cats.join(', ')}]`
    : 'Nema preklapanja kategorija između izbora i partnera.'

  await insertSyncJob({
    scope,
    ownerUserId: ownerUserId,
    partnerId,
    categories: okCats ? cats : [],
    status: okCats ? 'ok' : 'error',
    message,
  })

  res.status(200).json({ ok: true })
}

