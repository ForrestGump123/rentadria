/** Resolve gallery URLs for a public listing (draft images or deterministic demo seeds). */

export function listingImageUrlServer(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname === 'images.unsplash.com' || u.hostname.endsWith('.unsplash.com')) {
      u.searchParams.set('fm', 'webp')
      u.searchParams.set('q', u.searchParams.get('q') ?? '80')
      if (u.searchParams.has('auto')) u.searchParams.delete('auto')
      return u.toString()
    }
  } catch {
    /* ignore */
  }
  return url
}

export function defaultGalleryUrlsForListingId(listingId: string): string[] {
  const seedBase = listingId.replace(/[^a-zA-Z0-9_-]/g, '')
  const main = `https://picsum.photos/seed/ra-${seedBase}-main/1200/780`
  const rest = [1, 2, 3, 4].map((i) => `https://picsum.photos/seed/ra-${seedBase}-g${i}/1200/780`)
  return [main, ...rest].map(listingImageUrlServer)
}

export function galleryUrlsFromDraft(draft: Record<string, unknown> | null | undefined): string[] | null {
  if (!draft) return null
  const im = draft.images
  if (!Array.isArray(im)) return null
  const urls = im
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x) => listingImageUrlServer(x.trim()))
  return urls.length > 0 ? urls : null
}
