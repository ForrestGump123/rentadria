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

export async function fetchAdminListingGalleryAlbums(): Promise<AdminGalleryAlbumRow[] | null> {
  try {
    const r = await fetch('/api/admin-listing-gallery-albums', { credentials: 'include' })
    if (!r.ok) return null
    const j = (await r.json()) as { ok?: boolean; albums?: AdminGalleryAlbumRow[] }
    if (!j.ok || !Array.isArray(j.albums)) return null
    return j.albums
  } catch {
    return null
  }
}
