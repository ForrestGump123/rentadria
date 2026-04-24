import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuthIpFromVercel, verifyAdminCookie } from '../server/lib/adminAuthDispatch.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { rateLimitIp } from '../server/lib/rateLimitIp.js'
import { getSupabaseAdmin } from '../server/lib/supabaseAdmin.js'
import { cloudDeleteOwnerListing } from '../server/lib/rentadriaCloudData.js'
import { deleteListingGalleryAdmin } from '../server/lib/listingGalleryAdminDb.js'

type Row = {
  rowId: string
  ownerUserId: string
  category: 'accommodation' | 'car' | 'motorcycle'
  title: string
  publicListingId: string | null
  createdAt: string
  countryId: string | null
  ownerDisplayName: string
}

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

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    res.status(503).json({ ok: false, error: 'supabase_not_configured' })
    return
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('rentadria_owner_listings')
      .select('id, user_id, category, title, public_listing_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5000)

    if (error || !Array.isArray(data)) {
      res.status(500).json({ ok: false })
      return
    }

    const userIds = Array.from(
      new Set(
        data
          .map((r) => (r && typeof r === 'object' ? (r as { user_id?: unknown }).user_id : null))
          .filter((x): x is string => typeof x === 'string' && x.trim().length > 0),
      ),
    )

    const nameMap = new Map<string, { displayName: string; countryId: string | null }>()
    if (userIds.length > 0) {
      const { data: owners } = await supabase
        .from('rentadria_registered_owners')
        .select('user_id, display_name, country_id')
        .in('user_id', userIds)
      if (Array.isArray(owners)) {
        for (const raw of owners) {
          const r = raw as { user_id?: unknown; display_name?: unknown; country_id?: unknown }
          const uid = typeof r.user_id === 'string' ? r.user_id.trim().toLowerCase() : ''
          if (!uid) continue
          const dn = typeof r.display_name === 'string' && r.display_name.trim() ? r.display_name.trim() : uid
          const cid = typeof r.country_id === 'string' && r.country_id.trim() ? r.country_id.trim().toLowerCase() : null
          nameMap.set(uid, { displayName: dn, countryId: cid })
        }
      }
    }

    const rows: Row[] = []
    for (const raw of data) {
      const r = raw as {
        id?: unknown
        user_id?: unknown
        category?: unknown
        title?: unknown
        public_listing_id?: unknown
        created_at?: unknown
      }
      const rowId = typeof r.id === 'string' ? r.id : ''
      const ownerUserId = typeof r.user_id === 'string' ? r.user_id.trim().toLowerCase() : ''
      const category = r.category
      if (!rowId || !ownerUserId) continue
      if (category !== 'accommodation' && category !== 'car' && category !== 'motorcycle') continue
      const info = nameMap.get(ownerUserId)
      rows.push({
        rowId,
        ownerUserId,
        category,
        title: typeof r.title === 'string' ? r.title : '',
        publicListingId: typeof r.public_listing_id === 'string' && r.public_listing_id.trim() ? r.public_listing_id.trim() : null,
        createdAt: typeof r.created_at === 'string' ? r.created_at : new Date().toISOString(),
        ownerDisplayName: info?.displayName ?? ownerUserId,
        countryId: info?.countryId ?? null,
      })
    }

    res.status(200).json({ ok: true, rows })
    return
  }

  if (req.method === 'POST') {
    const body = parseRequestJsonRecord(req)
    const action = typeof body.action === 'string' ? body.action : ''
    if (action !== 'delete') {
      res.status(400).json({ ok: false, error: 'invalid_action' })
      return
    }
    const ownerUserId = typeof body.ownerUserId === 'string' ? body.ownerUserId.trim().toLowerCase() : ''
    const rowId = typeof body.rowId === 'string' ? body.rowId.trim() : ''
    if (!ownerUserId || !rowId) {
      res.status(400).json({ ok: false, error: 'invalid_body' })
      return
    }
    const { data: existing } = await supabase
      .from('rentadria_owner_listings')
      .select('public_listing_id')
      .eq('id', rowId)
      .eq('user_id', ownerUserId)
      .maybeSingle()
    const pubId =
      existing && typeof existing === 'object' && typeof (existing as { public_listing_id?: unknown }).public_listing_id === 'string'
        ? (existing as { public_listing_id: string }).public_listing_id.trim()
        : ''
    if (pubId) await deleteListingGalleryAdmin(pubId)
    const ok = await cloudDeleteOwnerListing(ownerUserId, rowId)
    res.status(ok ? 200 : 500).json({ ok })
    return
  }

  res.status(405).json({ ok: false })
}

