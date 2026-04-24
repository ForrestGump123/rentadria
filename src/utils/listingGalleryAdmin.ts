/**
 * Admin gallery: hide images on the public site and reorder thumbnails.
 * Overlay is cached in memory and persisted to Supabase via admin API; public reads use `/api/listing-gallery-admin`.
 */

type Overlay = { blocked: string[]; order: string[] }

const overlay: Record<string, Overlay> = {}
const adminOwnerByListing = new Map<string, string>()

function bump() {
  try {
    window.dispatchEvent(new Event('rentadria-listing-gallery-admin-changed'))
  } catch {
    /* ignore */
  }
}

export function setGalleryAdminOwnerContext(listingId: string, ownerUserId: string): void {
  const lid = listingId.trim()
  if (!lid) return
  adminOwnerByListing.set(lid, ownerUserId.trim().toLowerCase())
}

export function clearGalleryAdminOwnerContext(listingId: string): void {
  adminOwnerByListing.delete(listingId.trim())
}

function ensureOverlay(lid: string): Overlay {
  if (!overlay[lid]) overlay[lid] = { blocked: [], order: [] }
  return overlay[lid]!
}

export function applyListingGalleryOverlayFromPayload(
  listingId: string,
  blockedUrls: string[],
  orderedUrls: string[],
): void {
  const lid = listingId.trim()
  if (!lid) return
  overlay[lid] = { blocked: [...blockedUrls], order: [...orderedUrls] }
  bump()
}

export async function hydrateListingGalleryFromServer(listingId: string): Promise<void> {
  const lid = listingId.trim()
  if (!lid) return
  try {
    const r = await fetch(`/api/listing-gallery-admin?listingId=${encodeURIComponent(lid)}`)
    const j = (await r.json()) as { ok?: boolean; blockedUrls?: string[]; orderedUrls?: string[] }
    if (r.ok && j.ok) {
      applyListingGalleryOverlayFromPayload(lid, j.blockedUrls ?? [], j.orderedUrls ?? [])
    }
  } catch {
    /* ignore */
  }
}

async function persistOverlay(listingId: string): Promise<boolean> {
  const lid = listingId.trim()
  const uid = adminOwnerByListing.get(lid)
  if (!uid) return false
  const o = overlay[lid] ?? { blocked: [], order: [] }
  try {
    const r = await fetch('/api/admin-listing-gallery', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listingId: lid,
        ownerUserId: uid,
        blockedUrls: o.blocked,
        orderedUrls: o.order,
      }),
    })
    return r.ok
  } catch {
    return false
  }
}

/** Puna lista za admin album (uključuje sakrivene), s primijenjenim redom. */
export function listGalleryForAdmin(listingId: string, base: string[]): string[] {
  const lid = listingId.trim()
  const order = overlay[lid]?.order
  if (order?.length) {
    const inOrder = order.filter((u) => base.includes(u))
    const rest = base.filter((u) => !inOrder.includes(u))
    return [...inOrder, ...rest]
  }
  return base
}

/** `base` = npr. detail.gallery.map(listingImageUrl) */
export function getEffectiveGallery(listingId: string, base: string[]): string[] {
  const lid = listingId.trim()
  const blocked = new Set(overlay[lid]?.blocked ?? [])
  const order = overlay[lid]?.order
  const filtered = base.filter((u) => !blocked.has(u))
  if (order?.length) {
    const inOrder = order.filter((u) => filtered.includes(u))
    const rest = filtered.filter((u) => !inOrder.includes(u))
    return [...inOrder, ...rest]
  }
  return filtered
}

export function setGalleryOrder(listingId: string, urls: string[]): void {
  const lid = listingId.trim()
  const o = ensureOverlay(lid)
  o.order = [...urls]
  void persistOverlay(lid)
  bump()
}

export function toggleImageBlocked(listingId: string, imageUrl: string): boolean {
  const lid = listingId.trim()
  const o = ensureOverlay(lid)
  const arr = [...o.blocked]
  const i = arr.indexOf(imageUrl)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(imageUrl)
  o.blocked = arr
  void persistOverlay(lid)
  bump()
  return i < 0
}

export function isImageBlocked(listingId: string, imageUrl: string): boolean {
  return (overlay[listingId.trim()]?.blocked ?? []).includes(imageUrl)
}
