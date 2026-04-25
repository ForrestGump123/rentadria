import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { getSupabaseAdmin } from '../server/lib/supabaseAdmin.js'

type ListingCategory = 'accommodation' | 'car' | 'motorcycle'

type PublicOwnerListing = {
  id: string
  userId: string
  category: ListingCategory
  title: string
  viewsMonth: number
  contactClicksMonth: number
  receivedAt: string
  expiresAt: string
  featuredUntil: string | null
  internalNote: string | null
  publicListingId: string
  draft: Record<string, unknown>
}

function parseCategory(raw: unknown): ListingCategory | null {
  if (raw === 'accommodation' || raw === 'car' || raw === 'motorcycle') return raw
  return null
}

function ownerBlockedOrDeleted(raw: Record<string, unknown> | undefined): boolean {
  if (!raw) return false
  if (raw.deleted_at != null && String(raw.deleted_at).trim() !== '') return true
  const meta = raw.admin_meta
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    return (meta as Record<string, unknown>).blocked === true
  }
  return false
}

function draftKey(ownerUserId: string, ownerRowId: string, category: ListingCategory): string {
  return `${ownerUserId}::${ownerRowId}::${category}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`public-owner-listings:${ip}`, 80, 60_000)) {
    send429(res)
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const sb = getSupabaseAdmin()
  if (!sb) {
    res.status(503).json({ ok: false, error: 'owner_backend_unavailable' })
    return
  }

  const { data: listingRows, error: listingError } = await sb
    .from('rentadria_owner_listings')
    .select(
      'id, user_id, category, title, views_month, contact_clicks_month, received_at, expires_at, featured_until, internal_note, public_listing_id',
    )
    .not('public_listing_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (listingError || !Array.isArray(listingRows)) {
    res.status(500).json({ ok: false })
    return
  }

  const ownerIds = Array.from(
    new Set(
      listingRows
        .map((row) =>
          typeof (row as Record<string, unknown>).user_id === 'string'
            ? String((row as Record<string, unknown>).user_id).trim().toLowerCase()
            : '',
        )
        .filter(Boolean),
    ),
  )

  const ownerMap = new Map<string, Record<string, unknown>>()
  if (ownerIds.length > 0) {
    const { data: owners } = await sb
      .from('rentadria_registered_owners')
      .select('user_id, deleted_at, admin_meta')
      .in('user_id', ownerIds)
    if (Array.isArray(owners)) {
      for (const raw of owners) {
        const rec = raw as Record<string, unknown>
        const userId = typeof rec.user_id === 'string' ? rec.user_id.trim().toLowerCase() : ''
        if (userId) ownerMap.set(userId, rec)
      }
    }
  }

  const visibleRows = listingRows.filter((raw) => {
    const rec = raw as Record<string, unknown>
    const userId = typeof rec.user_id === 'string' ? rec.user_id.trim().toLowerCase() : ''
    const publicListingId = typeof rec.public_listing_id === 'string' ? rec.public_listing_id.trim() : ''
    return Boolean(userId && publicListingId && parseCategory(rec.category) && !ownerBlockedOrDeleted(ownerMap.get(userId)))
  })

  const rowIds = visibleRows
    .map((row) => (typeof (row as Record<string, unknown>).id === 'string' ? String((row as Record<string, unknown>).id) : ''))
    .filter(Boolean)

  const draftMap = new Map<string, Record<string, unknown>>()
  if (rowIds.length > 0) {
    const { data: drafts } = await sb
      .from('rentadria_listing_drafts')
      .select('owner_user_id, owner_row_id, category, draft')
      .in('owner_row_id', rowIds)
      .limit(1000)
    if (Array.isArray(drafts)) {
      for (const raw of drafts) {
        const rec = raw as Record<string, unknown>
        const ownerUserId = typeof rec.owner_user_id === 'string' ? rec.owner_user_id.trim().toLowerCase() : ''
        const ownerRowId = typeof rec.owner_row_id === 'string' ? rec.owner_row_id.trim() : ''
        const category = parseCategory(rec.category)
        const draft = rec.draft && typeof rec.draft === 'object' && !Array.isArray(rec.draft) ? rec.draft : null
        if (ownerUserId && ownerRowId && category && draft) {
          draftMap.set(draftKey(ownerUserId, ownerRowId, category), draft as Record<string, unknown>)
        }
      }
    }
  }

  const listings: PublicOwnerListing[] = []
  for (const raw of visibleRows) {
    const rec = raw as Record<string, unknown>
    const id = typeof rec.id === 'string' ? rec.id : ''
    const userId = typeof rec.user_id === 'string' ? rec.user_id.trim().toLowerCase() : ''
    const category = parseCategory(rec.category)
    const publicListingId = typeof rec.public_listing_id === 'string' ? rec.public_listing_id.trim() : ''
    if (!id || !userId || !category || !publicListingId) continue
    const draft = draftMap.get(draftKey(userId, id, category))
    if (!draft) continue
    listings.push({
      id,
      userId,
      category,
      title: typeof rec.title === 'string' ? rec.title : '',
      viewsMonth: Number(rec.views_month) || 0,
      contactClicksMonth: Number(rec.contact_clicks_month) || 0,
      receivedAt: typeof rec.received_at === 'string' ? rec.received_at : '',
      expiresAt: typeof rec.expires_at === 'string' ? rec.expires_at : '',
      featuredUntil: rec.featured_until == null || rec.featured_until === '' ? null : String(rec.featured_until),
      internalNote: rec.internal_note == null || rec.internal_note === '' ? null : String(rec.internal_note),
      publicListingId,
      draft,
    })
  }

  res.status(200).json({ ok: true, listings })
}
