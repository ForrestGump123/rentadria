import { allListings } from '../data/listings'

/** Javni demo katalog (statički JSON u bundle-u). */
export function countCatalogListings(): number {
  return allListings.length
}

/**
 * Redovi na tabli vlasnika u ovom pregledniku (`rentadria_owner_listings_by_user`).
 * Nema centralne tabele oglasa na serveru — broj je stvaran za ovaj browser/admin sesiju.
 */
export function countOwnerListingRows(): number {
  try {
    const raw = localStorage.getItem('rentadria_owner_listings_by_user')
    if (!raw) return 0
    const m = JSON.parse(raw) as Record<string, unknown>
    let n = 0
    for (const rows of Object.values(m)) {
      if (Array.isArray(rows)) n += rows.length
    }
    return n
  } catch {
    return 0
  }
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
