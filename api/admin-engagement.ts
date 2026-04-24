import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { verifyAdminCookie } from '../server/lib/adminAuthDispatch.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { getSupabaseAdmin } from '../server/lib/supabaseAdmin.js'

type MetricRow = {
  owner_user_id: string
  public_listing_id: string
  views: number
  contact_clicks: number
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`admin-engagement:${ip}`, 60, 60_000)) {
    send429(res)
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const adminOk = await verifyAdminCookie(cookieHeader)
  if (!adminOk) {
    res.status(401).json({ ok: false })
    return
  }

  const ym = typeof req.query?.ym === 'string' ? req.query.ym : ''
  if (!/^[0-9]{4}-[0-9]{2}$/.test(ym)) {
    res.status(400).json({ ok: false, error: 'invalid_ym' })
    return
  }

  const sb = getSupabaseAdmin()
  if (!sb) {
    res.status(503).json({ ok: false, error: 'supabase_not_configured' })
    return
  }

  const { data, error } = await sb
    .from('rentadria_listing_metrics_monthly')
    .select('owner_user_id, public_listing_id, views, contact_clicks')
    .eq('ym', ym)
    .limit(5000)

  if (error || !Array.isArray(data)) {
    res.status(500).json({ ok: false, error: error?.message ?? 'select_failed' })
    return
  }

  const byOwner: Record<
    string,
    { ownerUserId: string; views: number; contacts: number; byListing: Array<{ listingId: string; views: number; contacts: number }> }
  > = {}

  for (const raw of data as unknown as MetricRow[]) {
    const ownerUserId = String(raw.owner_user_id || '').trim().toLowerCase()
    const listingId = String(raw.public_listing_id || '').trim()
    if (!ownerUserId || !listingId) continue
    const v = Number(raw.views) || 0
    const c = Number(raw.contact_clicks) || 0
    const cur =
      byOwner[ownerUserId] ??
      (byOwner[ownerUserId] = { ownerUserId, views: 0, contacts: 0, byListing: [] })
    cur.views += v
    cur.contacts += c
    cur.byListing.push({ listingId, views: v, contacts: c })
  }

  const owners = Object.values(byOwner).sort((a, b) => b.views + b.contacts - (a.views + a.contacts))
  const total = owners.reduce((s, o) => s + o.contacts, 0)

  res.status(200).json({ ok: true, ym, totalContacts: total, owners })
}

