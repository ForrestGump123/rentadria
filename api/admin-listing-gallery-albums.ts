import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuthIpFromVercel, verifyAdminCookie } from '../server/lib/adminAuthDispatch.js'
import { rateLimitIp } from '../server/lib/rateLimitIp.js'
import { getSupabaseAdmin } from '../server/lib/supabaseAdmin.js'
import { defaultGalleryUrlsForListingId, galleryUrlsFromDraft } from '../server/lib/listingGalleryBaseUrls.js'
import type { ListingGalleryAdminOverlay } from '../server/lib/listingGalleryAdminDb.js'

export type AdminGalleryAlbumRow = {
  listingId: string
  ownerRowId: string
  ownerUserId: string
  category: 'accommodation' | 'car' | 'motorcycle'
  title: string
  ownerDisplayName: string
  baseUrls: string[]
  blockedUrls: string[]
  orderedUrls: string[]
}

function parseOverlay(raw: Record<string, unknown> | undefined): ListingGalleryAdminOverlay {
  if (!raw) return { blockedUrls: [], orderedUrls: [] }
  const b = raw.blocked_urls
  const o = raw.ordered_urls
  const blockedUrls = Array.isArray(b) ? b.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : []
  const orderedUrls = Array.isArray(o) ? o.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : []
  return { blockedUrls, orderedUrls }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }

  const ip = adminAuthIpFromVercel(req)
  if (!rateLimitIp(ip, 60, 60_000)) {
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

  const { data: listings, error: listErr } = await supabase
    .from('rentadria_owner_listings')
    .select('id, user_id, category, title, public_listing_id')
    .not('public_listing_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(3000)

  if (listErr || !Array.isArray(listings)) {
    res.status(500).json({ ok: false })
    return
  }

  const userIds = Array.from(
    new Set(
      listings
        .map((r) => (r && typeof r === 'object' ? (r as { user_id?: unknown }).user_id : null))
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => x.trim().toLowerCase()),
    ),
  )

  const nameMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: owners } = await supabase
      .from('rentadria_registered_owners')
      .select('user_id, display_name, email')
      .in('user_id', userIds)
    if (Array.isArray(owners)) {
      for (const raw of owners) {
        const r = raw as { user_id?: unknown; display_name?: unknown; email?: unknown }
        const uid = typeof r.user_id === 'string' ? r.user_id.trim().toLowerCase() : ''
        if (!uid) continue
        const dn = typeof r.display_name === 'string' && r.display_name.trim() ? r.display_name.trim() : ''
        const em = typeof r.email === 'string' && r.email.trim() ? r.email.trim().toLowerCase() : ''
        nameMap.set(uid, dn || em || uid)
      }
    }
  }

  const publicIds: string[] = []
  for (const raw of listings) {
    const r = raw as { public_listing_id?: unknown }
    const pid = typeof r.public_listing_id === 'string' ? r.public_listing_id.trim() : ''
    if (pid) publicIds.push(pid)
  }

  const gaMap = new Map<string, ListingGalleryAdminOverlay>()
  if (publicIds.length > 0) {
    const { data: gaRows } = await supabase
      .from('rentadria_listing_gallery_admin')
      .select('listing_id, blocked_urls, ordered_urls')
      .in('listing_id', publicIds)
    if (Array.isArray(gaRows)) {
      for (const raw of gaRows) {
        const r = raw as { listing_id?: unknown }
        const lid = typeof r.listing_id === 'string' ? r.listing_id.trim() : ''
        if (!lid) continue
        gaMap.set(lid, parseOverlay(raw as Record<string, unknown>))
      }
    }
  }

  const draftMap = new Map<string, Record<string, unknown>>()
  if (userIds.length > 0) {
    const { data: drafts } = await supabase
      .from('rentadria_listing_drafts')
      .select('owner_user_id, owner_row_id, category, draft')
      .in('owner_user_id', userIds)
    if (Array.isArray(drafts)) {
      for (const raw of drafts) {
        const r = raw as { owner_user_id?: unknown; owner_row_id?: unknown; category?: unknown; draft?: unknown }
        const uid = typeof r.owner_user_id === 'string' ? r.owner_user_id.trim().toLowerCase() : ''
        const rid = typeof r.owner_row_id === 'string' ? r.owner_row_id.trim() : ''
        const cat = r.category
        if (!uid || !rid || (cat !== 'accommodation' && cat !== 'car' && cat !== 'motorcycle')) continue
        const draft =
          r.draft && typeof r.draft === 'object' && !Array.isArray(r.draft) ? (r.draft as Record<string, unknown>) : null
        if (!draft) continue
        draftMap.set(`${uid}|${rid}|${cat}`, draft)
      }
    }
  }

  const albums: AdminGalleryAlbumRow[] = []
  const seenListingIds = new Set<string>()
  for (const raw of listings) {
    const r = raw as {
      id?: unknown
      user_id?: unknown
      category?: unknown
      title?: unknown
      public_listing_id?: unknown
    }
    const rowId = typeof r.id === 'string' ? r.id : ''
    const ownerUserId = typeof r.user_id === 'string' ? r.user_id.trim().toLowerCase() : ''
    const cat = r.category
    const listingId = typeof r.public_listing_id === 'string' ? r.public_listing_id.trim() : ''
    if (!rowId || !ownerUserId || !listingId) continue
    if (seenListingIds.has(listingId)) continue
    seenListingIds.add(listingId)
    if (cat !== 'accommodation' && cat !== 'car' && cat !== 'motorcycle') continue

    const draft = draftMap.get(`${ownerUserId}|${rowId}|${cat}`) ?? null
    const fromDraft = galleryUrlsFromDraft(draft)
    const baseUrls = fromDraft ?? defaultGalleryUrlsForListingId(listingId)
    const ga = gaMap.get(listingId) ?? { blockedUrls: [], orderedUrls: [] }

    albums.push({
      listingId,
      ownerRowId: rowId,
      ownerUserId,
      category: cat,
      title: typeof r.title === 'string' ? r.title : '',
      ownerDisplayName: nameMap.get(ownerUserId) ?? ownerUserId,
      baseUrls,
      blockedUrls: ga.blockedUrls,
      orderedUrls: ga.orderedUrls,
    })
  }

  albums.sort((a, b) => a.listingId.localeCompare(b.listingId))
  res.status(200).json({ ok: true, albums })
}
