/**
 * Prefer WebP for Unsplash URLs (same dimensions/quality intent, smaller transfer).
 * Other URLs unchanged.
 */
export function listingImageUrl(url: string): string {
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
