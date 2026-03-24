import { allListings } from '../data/listings'

export function countListings(): number {
  return allListings.length
}

export function countReportRows(): number {
  try {
    const raw = localStorage.getItem('rentadria_reports')
    const prev = JSON.parse(raw || '[]') as unknown
    return Array.isArray(prev) ? prev.length : 0
  } catch {
    return 0
  }
}

/** Approximate: number of listings that have at least one saved review entry */
export function countReviewBuckets(): number {
  if (typeof localStorage === 'undefined') return 0
  let n = 0
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith('rentadria_reviews_')) n++
  }
  return n
}

export function countOwnerAccounts(): number {
  try {
    const raw = localStorage.getItem('rentadria_owner_listings_by_user')
    if (!raw) return 0
    const m = JSON.parse(raw) as Record<string, unknown>
    return Object.keys(m).length
  } catch {
    return 0
  }
}
