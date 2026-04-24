import { getSupabaseAdmin } from './supabaseAdmin.js'

const T = 'rentadria_listing_gallery_admin'

function parseUrlArray(raw: unknown, maxLen: number): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const x of raw) {
    if (typeof x !== 'string') continue
    const s = x.trim()
    if (!s || s.length > 4000) continue
    out.push(s)
    if (out.length >= maxLen) break
  }
  return out
}

export type ListingGalleryAdminOverlay = {
  blockedUrls: string[]
  orderedUrls: string[]
}

export async function getListingGalleryAdminOverlay(listingId: string): Promise<ListingGalleryAdminOverlay | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const lid = listingId.trim()
  if (!lid) return null
  const { data, error } = await sb
    .from(T)
    .select('blocked_urls, ordered_urls')
    .eq('listing_id', lid)
    .maybeSingle()
  if (error) return null
  if (!data || typeof data !== 'object') return { blockedUrls: [], orderedUrls: [] }
  const r = data as Record<string, unknown>
  return {
    blockedUrls: parseUrlArray(r.blocked_urls, 200),
    orderedUrls: parseUrlArray(r.ordered_urls, 200),
  }
}

export async function upsertListingGalleryAdmin(input: {
  listingId: string
  ownerUserId: string
  blockedUrls: string[]
  orderedUrls: string[]
}): Promise<boolean> {
  const sb = getSupabaseAdmin()
  if (!sb) return false
  const lid = input.listingId.trim()
  const uid = input.ownerUserId.trim().toLowerCase()
  if (!lid || !uid) return false
  const blockedUrls = parseUrlArray(input.blockedUrls, 200)
  const orderedUrls = parseUrlArray(input.orderedUrls, 200)
  const row = {
    listing_id: lid,
    owner_user_id: uid,
    blocked_urls: blockedUrls,
    ordered_urls: orderedUrls,
    updated_at: new Date().toISOString(),
  }
  const { error } = await sb.from(T).upsert(row, { onConflict: 'listing_id' })
  return !error
}

export async function deleteListingGalleryAdmin(listingId: string): Promise<void> {
  const sb = getSupabaseAdmin()
  if (!sb) return
  const lid = listingId.trim()
  if (!lid) return
  try {
    await sb.from(T).delete().eq('listing_id', lid)
  } catch {
    /* ignore */
  }
}
