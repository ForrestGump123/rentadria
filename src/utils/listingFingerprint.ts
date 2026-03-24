import type { Listing } from '../types'

/** Normalized key for duplicate detection (same category + place + same title family). */
export function listingFingerprint(listing: Listing): string {
  const titleBase = listing.title.replace(/\s*·\s*#\d+\s*$/i, '').trim().toLowerCase()
  const loc = listing.location.trim().toLowerCase().replace(/\s+/g, ' ')
  return `${listing.category}|${loc}|${titleBase}`
}

/** Returns true if `candidate` would duplicate an entry in `existing` (by fingerprint). */
export function isDuplicateListing(candidate: Listing, existing: Listing[]): boolean {
  const fp = listingFingerprint(candidate)
  return existing.some((l) => listingFingerprint(l) === fp)
}

/** Keeps first occurrence per fingerprint (protection against duplicate ads). */
export function dedupeListings(listings: Listing[]): Listing[] {
  const seen = new Set<string>()
  const out: Listing[] = []
  for (const l of listings) {
    const key = listingFingerprint(l)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(l)
  }
  return out
}
