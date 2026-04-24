export type StoredReview = {
  /** Stabilan ključ za admin akcije */
  id: string
  rating: number
  text: string
  at: string
  hidden?: boolean
  blocked?: boolean
}

let unreadReviews = 0
const byListing: Record<string, StoredReview[]> = {}

function ensureIds(listingId: string, rows: StoredReview[]): StoredReview[] {
  return rows.map((r, i) => ({
    ...r,
    id: r.id || `legacy-${listingId}-${i}-${r.at}`,
  }))
}

export function bumpAdminReviewUnread(): void {
  try {
    unreadReviews = Math.max(0, unreadReviews) + 1
    window.dispatchEvent(new Event('rentadria-admin-reviews-unread-changed'))
  } catch {
    /* ignore */
  }
}

export function getAdminReviewUnreadCount(): number {
  return Math.max(0, unreadReviews)
}

export function clearAdminReviewUnread(): void {
  try {
    unreadReviews = 0
    window.dispatchEvent(new Event('rentadria-admin-reviews-unread-changed'))
  } catch {
    /* ignore */
  }
}

export function saveReviewsForListing(listingId: string, rows: StoredReview[]): void {
  const lid = listingId.trim()
  if (!lid) return
  byListing[lid] = ensureIds(lid, rows)
  try {
    window.dispatchEvent(new Event('rentadria-reviews-updated'))
  } catch {
    /* ignore */
  }
}

export function loadReviewsForListing(_listingId: string): StoredReview[] {
  const lid = _listingId.trim()
  return byListing[lid] ? [...byListing[lid]!] : []
}

export function listAllReviewListingIds(): string[] {
  return Object.keys(byListing)
}
