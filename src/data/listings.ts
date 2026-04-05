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

export const LISTING_IMAGE_FALLBACK = 'https://picsum.photos/seed/rentadria-fallback/800/520'

/**
 * Javni seed oglasi (demo): po četiri po kategoriji za slideshow / layout.
 * Uz to se i dalje spajaju oglasi vlasnika iz localStorage.
 */
const raw: Omit<Listing, 'title' | 'titleSlot'>[] = [
  {
    id: 'demo-seed-accommodation',
    category: 'accommodation',
    location: 'Dubrovnik, HR',
    priceLabel: '€85 / night',
    image: 'https://picsum.photos/seed/rentadria-demo-accommodation/800/520',
    createdAt: '2025-06-01T12:00:00.000Z',
    featured: true,
    ownerPropertyType: 'apartment',
  },
  {
    id: 'demo-seed-accommodation-2',
    category: 'accommodation',
    location: 'Budva, ME',
    priceLabel: '€72 / night',
    image: 'https://picsum.photos/seed/rentadria-demo-accommodation-2/800/520',
    createdAt: '2025-05-30T12:00:00.000Z',
    featured: true,
    ownerPropertyType: 'studio',
  },
  {
    id: 'demo-seed-accommodation-3',
    category: 'accommodation',
    location: 'Zadar, HR',
    priceLabel: '€95 / night',
    image: 'https://picsum.photos/seed/rentadria-demo-accommodation-3/800/520',
    createdAt: '2025-05-25T12:00:00.000Z',
    ownerPropertyType: 'villa',
  },
  {
    id: 'demo-seed-accommodation-4',
    category: 'accommodation',
    location: 'Ulcinj, ME',
    priceLabel: '€55 / night',
    image: 'https://picsum.photos/seed/rentadria-demo-accommodation-4/800/520',
    createdAt: '2025-05-18T12:00:00.000Z',
    ownerPropertyType: 'room',
  },
  {
    id: 'demo-seed-car',
    category: 'car',
    location: 'Split, HR',
    priceLabel: '€45 / day',
    image: 'https://picsum.photos/seed/rentadria-demo-car/800/520',
    createdAt: '2025-05-28T12:00:00.000Z',
    ownerVehicleMake: 'Volkswagen',
  },
  {
    id: 'demo-seed-car-2',
    category: 'car',
    location: 'Podgorica, ME',
    priceLabel: '€38 / day',
    image: 'https://picsum.photos/seed/rentadria-demo-car-2/800/520',
    createdAt: '2025-05-26T12:00:00.000Z',
    featured: true,
    ownerVehicleMake: 'Škoda',
  },
  {
    id: 'demo-seed-car-3',
    category: 'car',
    location: 'Tirana, AL',
    priceLabel: '€42 / day',
    image: 'https://picsum.photos/seed/rentadria-demo-car-3/800/520',
    createdAt: '2025-05-22T12:00:00.000Z',
    ownerVehicleMake: 'Toyota',
  },
  {
    id: 'demo-seed-car-4',
    category: 'car',
    location: 'Sarajevo, BA',
    priceLabel: '€35 / day',
    image: 'https://picsum.photos/seed/rentadria-demo-car-4/800/520',
    createdAt: '2025-05-15T12:00:00.000Z',
    ownerVehicleMake: 'Ford',
  },
  {
    id: 'demo-seed-motorcycle',
    category: 'motorcycle',
    location: 'Kotor, ME',
    priceLabel: '€25 / day',
    image: 'https://picsum.photos/seed/rentadria-demo-motorcycle/800/520',
    createdAt: '2025-05-20T12:00:00.000Z',
    ownerVehicleMake: 'Yamaha',
  },
  {
    id: 'demo-seed-motorcycle-2',
    category: 'motorcycle',
    location: 'Herceg Novi, ME',
    priceLabel: '€22 / day',
    image: 'https://picsum.photos/seed/rentadria-demo-motorcycle-2/800/520',
    createdAt: '2025-05-19T12:00:00.000Z',
    featured: true,
    ownerVehicleMake: 'Honda',
  },
  {
    id: 'demo-seed-motorcycle-3',
    category: 'motorcycle',
    location: 'Bar, ME',
    priceLabel: '€18 / day',
    image: 'https://picsum.photos/seed/rentadria-demo-motorcycle-3/800/520',
    createdAt: '2025-05-12T12:00:00.000Z',
    ownerVehicleMake: 'Piaggio',
  },
  {
    id: 'demo-seed-motorcycle-4',
    category: 'motorcycle',
    location: 'Shkodër, AL',
    priceLabel: '€20 / day',
    image: 'https://picsum.photos/seed/rentadria-demo-motorcycle-4/800/520',
    createdAt: '2025-05-10T12:00:00.000Z',
    ownerVehicleMake: 'BMW',
  },
]

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
