export type StoredReview = {
  /** Stabilan ključ za admin akcije */
  id: string
  rating: number
  text: string
  at: string
  hidden?: boolean
  blocked?: boolean
}

const ADMIN_REV_UNREAD_KEY = 'rentadria_admin_reviews_unread_v1'

const key = (listingId: string) => `rentadria_reviews_${listingId}`

function ensureIds(listingId: string, rows: StoredReview[]): StoredReview[] {
  return rows.map((r, i) => ({
    ...r,
    id: r.id || `legacy-${listingId}-${i}-${r.at}`,
  }))
}

export function bumpAdminReviewUnread(): void {
  try {
    const n = Math.max(0, Number(localStorage.getItem(ADMIN_REV_UNREAD_KEY) || '0')) + 1
    localStorage.setItem(ADMIN_REV_UNREAD_KEY, String(n))
    window.dispatchEvent(new Event('rentadria-admin-reviews-unread-changed'))
  } catch {
    /* ignore */
  }
}

export function getAdminReviewUnreadCount(): number {
  try {
    return Math.max(0, Number(localStorage.getItem(ADMIN_REV_UNREAD_KEY) || '0'))
  } catch {
    return 0
  }
}

export function clearAdminReviewUnread(): void {
  try {
    localStorage.removeItem(ADMIN_REV_UNREAD_KEY)
    window.dispatchEvent(new Event('rentadria-admin-reviews-unread-changed'))
  } catch {
    /* ignore */
  }
}

export function loadReviewsForListing(listingId: string): StoredReview[] {
  try {
    const raw = localStorage.getItem(key(listingId))
    if (!raw) return []
    const a = JSON.parse(raw) as unknown
    const arr = Array.isArray(a) ? (a as StoredReview[]) : []
    return ensureIds(listingId, arr)
  } catch {
    return []
  }
}

export function saveReviewsForListing(listingId: string, rows: StoredReview[]): void {
  const withIds = ensureIds(listingId, rows)
  localStorage.setItem(key(listingId), JSON.stringify(withIds))
  try {
    window.dispatchEvent(new Event('rentadria-reviews-updated'))
  } catch {
    /* ignore */
  }
}

export function listAllReviewListingIds(): string[] {
  if (typeof localStorage === 'undefined') return []
  const out: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith('rentadria_reviews_')) {
      out.push(k.slice('rentadria_reviews_'.length))
    }
  }
  return out
}
