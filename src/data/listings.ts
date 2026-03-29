import type { Listing, ListingCategory } from '../types'
import {
  getAllOwnerListingRows,
  isOwnerPublicListingVisible,
  listingSuppressedOnPublicSite,
} from '../utils/ownerSession'
import { dedupeListings, isDuplicateListing, listingFingerprint } from '../utils/listingFingerprint'
import {
  ACCOMMODATION_DRAFT_LISTING_ID,
  ACCOMMODATION_DRAFT_LS_KEY,
  CAR_DRAFT_LS_KEY,
  MOTO_DRAFT_LS_KEY,
  listingFromAccommodationDraft,
  loadAccommodationDraft,
  OWNER_ACCOMMODATION_DRAFT_ID_PREFIX,
  OWNER_CAR_DRAFT_ID_PREFIX,
  OWNER_MOTO_DRAFT_ID_PREFIX,
} from '../utils/accommodationDraft'

export { isDuplicateListing, listingFingerprint }

export const LISTING_IMAGE_FALLBACK =
  'https://placehold.co/800x520/0a101e/26c6da/png?text=RentAdria'

/** Javni seed oglasi (demo) uklonjeni — na početnoj se prikazuju samo oglasi koje vlasnici objave u ovom pregledaču. */
const raw: Omit<Listing, 'title' | 'titleSlot'>[] = []

const titles: Record<ListingCategory, (i: number) => string> = {
  accommodation: (i) => {
    const pool = [
      'Sea-view apartment',
      'Studio in the old town',
      'Family villa with pool',
      'Cozy studio',
      'Stone house',
      'Lux penthouse',
      'Garden cottage',
      'Beachfront flat',
    ]
    return `${pool[i % pool.length]} · #${i + 1}`
  },
  car: (i) => {
    const pool = ['VW Tiguan SUV', 'Compact hatchback', 'Estate diesel', 'Convertible', 'SUV 4x4', 'City EV']
    return `${pool[i % pool.length]} · #${i + 1}`
  },
  motorcycle: (i) => {
    const pool = ['Scooter 125cc', 'Adventure 650', 'Naked 600', 'Sport tourer', 'Cruiser']
    return `${pool[i % pool.length]} · #${i + 1}`
  },
}

const builtListings: Listing[] = raw.map((r) => {
  const catIndex =
    r.category === 'accommodation'
      ? raw.filter((x) => x.category === 'accommodation').indexOf(r)
      : r.category === 'car'
        ? raw.filter((x) => x.category === 'car').indexOf(r)
        : raw.filter((x) => x.category === 'motorcycle').indexOf(r)
  return {
    ...r,
    titleSlot: catIndex,
    title: titles[r.category](catIndex),
  }
})

/** Deduplicated by category + location + title family (first wins). */
export const allListings: Listing[] = dedupeListings(builtListings)

export function getListingById(id: string): Listing | undefined {
  if (id === ACCOMMODATION_DRAFT_LISTING_ID) {
    const d = loadAccommodationDraft()
    return d ? listingFromAccommodationDraft(d, id) : undefined
  }
  if (id.startsWith(OWNER_ACCOMMODATION_DRAFT_ID_PREFIX)) {
    const rowId = id.slice(OWNER_ACCOMMODATION_DRAFT_ID_PREFIX.length)
    const d =
      loadAccommodationDraft(`${ACCOMMODATION_DRAFT_LS_KEY}::${rowId}`) ?? loadAccommodationDraft()
    return d ? listingFromAccommodationDraft(d, id) : undefined
  }
  if (id.startsWith(OWNER_CAR_DRAFT_ID_PREFIX)) {
    const rowId = id.slice(OWNER_CAR_DRAFT_ID_PREFIX.length)
    const d = loadAccommodationDraft(`${CAR_DRAFT_LS_KEY}::${rowId}`)
    return d ? listingFromAccommodationDraft(d, id) : undefined
  }
  if (id.startsWith(OWNER_MOTO_DRAFT_ID_PREFIX)) {
    const rowId = id.slice(OWNER_MOTO_DRAFT_ID_PREFIX.length)
    const d = loadAccommodationDraft(`${MOTO_DRAFT_LS_KEY}::${rowId}`)
    return d ? listingFromAccommodationDraft(d, id) : undefined
  }
  const found = allListings.find((l) => l.id === id)
  if (found && listingSuppressedOnPublicSite(id)) return undefined
  return found
}

export function getSimilarListings(listing: Listing, limit = 8): Listing[] {
  return allListings
    .filter(
      (l) =>
        l.id !== listing.id &&
        l.category === listing.category &&
        !listingSuppressedOnPublicSite(l.id),
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}

export function listingsByCategory(category: ListingCategory): Listing[] {
  return allListings
    .filter((l) => l.category === category && !listingSuppressedOnPublicSite(l.id))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

/** Demo oglasi + javni oglasi iz nacrta vlasnika (localStorage). */
export function listingsByCategoryMerged(category: ListingCategory): Listing[] {
  const base = listingsByCategory(category)
  const rows = getAllOwnerListingRows().filter(
    (r) => r.category === category && r.publicListingId && isOwnerPublicListingVisible(r.userId),
  )
  const seen = new Set(base.map((x) => x.id))
  const extra: Listing[] = []
  for (const r of rows) {
    const pid = r.publicListingId!
    const l = getListingById(pid)
    if (l && l.category === category && !seen.has(l.id)) {
      extra.push(l)
      seen.add(l.id)
    }
  }
  return [...base, ...extra].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export function featuredForCategory(category: ListingCategory): Listing[] {
  const list = listingsByCategory(category)
  const feat = list.filter((l) => l.featured)
  const rest = list.filter((l) => !l.featured)
  return [...feat, ...rest].slice(0, 24)
}

export function slideshowForCategory(category: ListingCategory): Listing[] {
  return listingsByCategory(category).slice(0, 8)
}
