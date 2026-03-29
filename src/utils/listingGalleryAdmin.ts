/** Admin: sakrivanje i redosled slika po javnom ID oglasa (localStorage). */

const BLOCK_KEY = 'rentadria_listing_image_blocked_v1'
const ORDER_KEY = 'rentadria_listing_gallery_order_v1'

function loadBlock(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(BLOCK_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as unknown
    return o && typeof o === 'object' ? (o as Record<string, string[]>) : {}
  } catch {
    return {}
  }
}

function saveBlock(m: Record<string, string[]>) {
  localStorage.setItem(BLOCK_KEY, JSON.stringify(m))
  try {
    window.dispatchEvent(new Event('rentadria-listing-gallery-admin-changed'))
  } catch {
    /* ignore */
  }
}

function loadOrder(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(ORDER_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as unknown
    return o && typeof o === 'object' ? (o as Record<string, string[]>) : {}
  } catch {
    return {}
  }
}

function saveOrder(m: Record<string, string[]>) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(m))
  try {
    window.dispatchEvent(new Event('rentadria-listing-gallery-admin-changed'))
  } catch {
    /* ignore */
  }
}

/** Puna lista za admin album (uključuje blokirane), s primijenjenim redom. */
export function listGalleryForAdmin(listingId: string, base: string[]): string[] {
  const order = loadOrder()[listingId]
  if (order?.length) {
    const inOrder = order.filter((u) => base.includes(u))
    const rest = base.filter((u) => !inOrder.includes(u))
    return [...inOrder, ...rest]
  }
  return base
}

/** `base` = npr. detail.gallery.map(listingImageUrl) */
export function getEffectiveGallery(listingId: string, base: string[]): string[] {
  const blocked = new Set(loadBlock()[listingId] ?? [])
  const order = loadOrder()[listingId]
  const filtered = base.filter((u) => !blocked.has(u))
  if (order?.length) {
    const inOrder = order.filter((u) => filtered.includes(u))
    const rest = filtered.filter((u) => !inOrder.includes(u))
    return [...inOrder, ...rest]
  }
  return filtered
}

export function setGalleryOrder(listingId: string, urls: string[]): void {
  const m = loadOrder()
  m[listingId] = urls
  saveOrder(m)
}

export function toggleImageBlocked(listingId: string, imageUrl: string): boolean {
  const m = loadBlock()
  const arr = [...(m[listingId] ?? [])]
  const i = arr.indexOf(imageUrl)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(imageUrl)
  m[listingId] = arr
  saveBlock(m)
  return i < 0
}

export function isImageBlocked(listingId: string, imageUrl: string): boolean {
  return (loadBlock()[listingId] ?? []).includes(imageUrl)
}
