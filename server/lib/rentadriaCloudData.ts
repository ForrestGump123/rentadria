import { getSupabaseAdmin } from './supabaseAdmin.js'

const T_LIST = 'rentadria_owner_listings'
const T_REV = 'rentadria_listing_reviews'
const T_REP = 'rentadria_listing_reports'

export type CloudOwnerListingRow = {
  id: string
  userId: string
  category: 'accommodation' | 'car' | 'motorcycle'
  title: string
  viewsMonth: number
  contactClicksMonth: number
  receivedAt: string
  expiresAt: string
  featuredUntil: string | null
  internalNote: string | null
  publicListingId?: string
}

export type StoredReviewJson = {
  id: string
  rating: number
  text: string
  at: string
  hidden?: boolean
  blocked?: boolean
}

function listingFromDb(r: Record<string, unknown>): CloudOwnerListingRow | null {
  const id = typeof r.id === 'string' ? r.id : ''
  const userId = typeof r.user_id === 'string' ? r.user_id.trim().toLowerCase() : ''
  const cat = r.category
  if (!id || !userId || (cat !== 'accommodation' && cat !== 'car' && cat !== 'motorcycle')) return null
  return {
    id,
    userId,
    category: cat,
    title: typeof r.title === 'string' ? r.title : '',
    viewsMonth: Number(r.views_month) || 0,
    contactClicksMonth: Number(r.contact_clicks_month) || 0,
    receivedAt: typeof r.received_at === 'string' ? r.received_at : '',
    expiresAt: typeof r.expires_at === 'string' ? r.expires_at : '',
    featuredUntil:
      r.featured_until == null || r.featured_until === '' ? null : String(r.featured_until),
    internalNote:
      r.internal_note == null || r.internal_note === '' ? null : String(r.internal_note),
    publicListingId:
      typeof r.public_listing_id === 'string' && r.public_listing_id.trim()
        ? r.public_listing_id.trim()
        : undefined,
  }
}

function listingToDb(row: CloudOwnerListingRow): Record<string, unknown> {
  return {
    id: row.id,
    user_id: row.userId.trim().toLowerCase(),
    category: row.category,
    title: row.title,
    views_month: row.viewsMonth ?? 0,
    contact_clicks_month: row.contactClicksMonth ?? 0,
    received_at: row.receivedAt,
    expires_at: row.expiresAt,
    featured_until: row.featuredUntil,
    internal_note: row.internalNote,
    public_listing_id: row.publicListingId ?? null,
    updated_at: new Date().toISOString(),
  }
}

export async function cloudListOwnerListings(userId: string): Promise<CloudOwnerListingRow[] | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const uid = userId.trim().toLowerCase()
  const { data, error } = await sb.from(T_LIST).select('*').eq('user_id', uid)
  if (error || !Array.isArray(data)) return null
  const out: CloudOwnerListingRow[] = []
  for (const raw of data) {
    const m = listingFromDb(raw as Record<string, unknown>)
    if (m) out.push(m)
  }
  return out
}

export async function cloudUpsertOwnerListing(row: CloudOwnerListingRow): Promise<boolean> {
  const sb = getSupabaseAdmin()
  if (!sb) return false
  const { error } = await sb.from(T_LIST).upsert(listingToDb(row), { onConflict: 'id' })
  return !error
}

export async function cloudDeleteOwnerListing(userId: string, rowId: string): Promise<boolean> {
  const sb = getSupabaseAdmin()
  if (!sb) return false
  const uid = userId.trim().toLowerCase()
  const { error } = await sb.from(T_LIST).delete().eq('id', rowId).eq('user_id', uid)
  return !error
}

export async function cloudGetReviews(listingId: string): Promise<StoredReviewJson[] | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const lid = listingId.trim()
  const { data, error } = await sb.from(T_REV).select('reviews').eq('listing_id', lid).maybeSingle()
  if (error) return null
  if (!data || typeof data !== 'object') return []
  const rev = (data as { reviews?: unknown }).reviews
  if (!Array.isArray(rev)) return []
  return rev as StoredReviewJson[]
}

export async function cloudReplaceReviews(listingId: string, reviews: StoredReviewJson[]): Promise<boolean> {
  const sb = getSupabaseAdmin()
  if (!sb) return false
  const lid = listingId.trim()
  const row = {
    listing_id: lid,
    reviews,
    updated_at: new Date().toISOString(),
  }
  const { error } = await sb.from(T_REV).upsert(row, { onConflict: 'listing_id' })
  return !error
}

export async function cloudAppendReview(listingId: string, review: StoredReviewJson): Promise<boolean> {
  const existing = await cloudGetReviews(listingId)
  if (existing === null) return false
  const next = [...existing, review]
  return cloudReplaceReviews(listingId, next)
}

export async function cloudListAllReviewsForAdmin(): Promise<{ listingId: string; reviews: StoredReviewJson[] }[]> {
  const sb = getSupabaseAdmin()
  if (!sb) return []
  const { data, error } = await sb.from(T_REV).select('listing_id, reviews')
  if (error || !Array.isArray(data)) return []
  const out: { listingId: string; reviews: StoredReviewJson[] }[] = []
  for (const raw of data) {
    const rec = raw as { listing_id?: string; reviews?: unknown }
    const lid = typeof rec.listing_id === 'string' ? rec.listing_id : ''
    if (!lid) continue
    const rev = Array.isArray(rec.reviews) ? (rec.reviews as StoredReviewJson[]) : []
    out.push({ listingId: lid, reviews: rev })
  }
  return out
}

export async function cloudInsertReport(payload: Record<string, unknown>): Promise<boolean> {
  const sb = getSupabaseAdmin()
  if (!sb) return false
  const { error } = await sb.from(T_REP).insert({ payload })
  return !error
}

export async function cloudListReports(): Promise<{ id: string; payload: Record<string, string>; at: string }[]> {
  const sb = getSupabaseAdmin()
  if (!sb) return []
  const { data, error } = await sb
    .from(T_REP)
    .select('id, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error || !Array.isArray(data)) return []
  const out: { id: string; payload: Record<string, string>; at: string }[] = []
  for (const raw of data) {
    const r = raw as { id?: string; payload?: unknown; created_at?: string }
    if (typeof r.id !== 'string') continue
    const p = r.payload && typeof r.payload === 'object' && !Array.isArray(r.payload) ? r.payload : {}
    const flat: Record<string, string> = {}
    for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
      flat[k] = v == null ? '' : String(v)
    }
    const at =
      typeof r.created_at === 'string' ? new Date(r.created_at).toISOString() : new Date().toISOString()
    out.push({ id: r.id, payload: flat, at })
  }
  return out
}

export async function cloudCountListings(): Promise<number | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const { count, error } = await sb.from(T_LIST).select('id', { count: 'exact', head: true })
  if (error) return null
  return typeof count === 'number' ? count : 0
}

export async function cloudCountReviewListings(): Promise<number | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const { count, error } = await sb.from(T_REV).select('listing_id', { count: 'exact', head: true })
  if (error) return null
  return typeof count === 'number' ? count : 0
}

export async function cloudCountReports(): Promise<number | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const { count, error } = await sb.from(T_REP).select('id', { count: 'exact', head: true })
  if (error) return null
  return typeof count === 'number' ? count : 0
}
