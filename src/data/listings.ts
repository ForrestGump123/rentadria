import type { Listing, ListingCategory } from '../types'
import { getAllOwnerListingRows } from '../utils/ownerSession'
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

/** Stable Unsplash URLs (no random seed redirects) — works when picsum is blocked. */
const IMAGE_POOL = [
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1558981806-ec527fa84e4a?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1609521262887-b7033f90e3e0?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80&auto=format&fit=crop',
] as const

export const LISTING_IMAGE_FALLBACK =
  'https://placehold.co/800x520/0a101e/26c6da/png?text=RentAdria'

function imageForListingId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 1_000_000
  return IMAGE_POOL[h % IMAGE_POOL.length]
}

const img = (listingId: string) => imageForListingId(listingId)

const raw: Omit<Listing, 'title' | 'titleSlot'>[] = [
  {
    id: 'a1',
    category: 'accommodation',
    location: 'Kotor, ME',
    priceLabel: '€80/night',
    image: img('a1'),
    createdAt: '2026-03-22T10:00:00Z',
    featured: true,
    verified: true,
  },
  { id: 'a2', category: 'accommodation', location: 'Dubrovnik, HR', priceLabel: '€120/night', image: img('a2'), createdAt: '2026-03-21T14:30:00Z', verified: true },
  { id: 'a3', category: 'accommodation', location: 'Herceg Novi, ME', priceLabel: '€65/night', image: img('a3'), createdAt: '2026-03-20T09:15:00Z', verified: true },
  {
    id: 'a4',
    category: 'accommodation',
    location: 'Budva, ME',
    priceLabel: '€95/night',
    image: img('a4'),
    createdAt: '2026-03-19T11:00:00Z',
    featured: true,
    verified: true,
  },
  { id: 'a5', category: 'accommodation', location: 'Split, HR', priceLabel: '€88/night', image: img('a5'), createdAt: '2026-03-18T16:45:00Z' },
  { id: 'a6', category: 'accommodation', location: 'Bar, ME', priceLabel: '€55/night', image: img('a6'), createdAt: '2026-03-17T08:20:00Z' },
  { id: 'a7', category: 'accommodation', location: 'Tivat, ME', priceLabel: '€110/night', image: img('a7'), createdAt: '2026-03-16T12:00:00Z' },
  { id: 'a8', category: 'accommodation', location: 'Ulcinj, ME', priceLabel: '€70/night', image: img('a8'), createdAt: '2026-03-15T19:30:00Z' },
  { id: 'a9', category: 'accommodation', location: 'Zadar, HR', priceLabel: '€78/night', image: img('a9'), createdAt: '2026-03-14T10:10:00Z' },
  { id: 'a10', category: 'accommodation', location: 'Podgorica, ME', priceLabel: '€45/night', image: img('a10'), createdAt: '2026-03-13T07:00:00Z' },
  { id: 'a11', category: 'accommodation', location: 'Kotor, ME', priceLabel: '€150/night', image: img('a11'), createdAt: '2026-03-12T13:40:00Z' },
  { id: 'a12', category: 'accommodation', location: 'Sarajevo, BA', priceLabel: '€52/night', image: img('a12'), createdAt: '2026-03-11T09:00:00Z' },
  { id: 'a13', category: 'accommodation', location: 'Shkodër, AL', priceLabel: '€48/night', image: img('a13'), createdAt: '2026-03-10T15:20:00Z' },
  { id: 'a14', category: 'accommodation', location: 'Bari, IT', priceLabel: '€92/night', image: img('a14'), createdAt: '2026-03-09T11:11:00Z' },
  { id: 'a15', category: 'accommodation', location: 'Valencia, ES', priceLabel: '€85/night', image: img('a15'), createdAt: '2026-03-08T18:00:00Z' },
  { id: 'a16', category: 'accommodation', location: 'Perast, ME', priceLabel: '€130/night', image: img('a16'), createdAt: '2026-03-07T12:12:00Z' },
  { id: 'a17', category: 'accommodation', location: 'Rovinj, HR', priceLabel: '€105/night', image: img('a17'), createdAt: '2026-03-06T09:30:00Z' },
  { id: 'a18', category: 'accommodation', location: 'Mostar, BA', priceLabel: '€60/night', image: img('a18'), createdAt: '2026-03-05T14:00:00Z' },
  { id: 'a19', category: 'accommodation', location: 'Durres, AL', priceLabel: '€50/night', image: img('a19'), createdAt: '2026-03-04T10:45:00Z' },
  { id: 'a20', category: 'accommodation', location: 'Palermo, IT', priceLabel: '€72/night', image: img('a20'), createdAt: '2026-03-03T08:08:00Z' },
  { id: 'a21', category: 'accommodation', location: 'Novi Sad, RS', priceLabel: '€58/night', image: img('a21'), createdAt: '2026-03-02T16:20:00Z' },
  { id: 'a22', category: 'accommodation', location: 'Beograd, RS', priceLabel: '€62/night', image: img('a22'), createdAt: '2026-03-01T11:00:00Z' },

  {
    id: 'c1',
    category: 'car',
    location: 'Podgorica',
    priceLabel: '€35/day',
    image: img('c1'),
    createdAt: '2026-03-22T09:00:00Z',
    featured: true,
    verified: true,
  },
  { id: 'c2', category: 'car', location: 'Tivat Airport', priceLabel: '€42/day', image: img('c2'), createdAt: '2026-03-21T11:20:00Z', verified: true },
  { id: 'c3', category: 'car', location: 'Dubrovnik', priceLabel: '€48/day', image: img('c3'), createdAt: '2026-03-20T08:50:00Z' },
  { id: 'c4', category: 'car', location: 'Split', priceLabel: '€39/day', image: img('c4'), createdAt: '2026-03-19T15:10:00Z' },
  { id: 'c5', category: 'car', location: 'Kotor', priceLabel: '€44/day', image: img('c5'), createdAt: '2026-03-18T10:00:00Z' },
  { id: 'c6', category: 'car', location: 'Bar', priceLabel: '€32/day', image: img('c6'), createdAt: '2026-03-17T12:30:00Z' },
  { id: 'c7', category: 'car', location: 'Zagreb', priceLabel: '€36/day', image: img('c7'), createdAt: '2026-03-16T09:45:00Z' },
  { id: 'c8', category: 'car', location: 'Sarajevo', priceLabel: '€33/day', image: img('c8'), createdAt: '2026-03-15T14:00:00Z' },
  { id: 'c9', category: 'car', location: 'Tirana', priceLabel: '€31/day', image: img('c9'), createdAt: '2026-03-14T08:25:00Z' },
  { id: 'c10', category: 'car', location: 'Bari', priceLabel: '€40/day', image: img('c10'), createdAt: '2026-03-13T13:13:00Z' },
  { id: 'c11', category: 'car', location: 'Valencia', priceLabel: '€37/day', image: img('c11'), createdAt: '2026-03-12T17:00:00Z' },
  { id: 'c12', category: 'car', location: 'Belgrade', priceLabel: '€29/day', image: img('c12'), createdAt: '2026-03-11T10:10:00Z' },
  { id: 'c13', category: 'car', location: 'Podgorica', priceLabel: '€55/day', image: img('c13'), createdAt: '2026-03-10T12:00:00Z' },
  { id: 'c14', category: 'car', location: 'Herceg Novi', priceLabel: '€41/day', image: img('c14'), createdAt: '2026-03-09T09:30:00Z' },
  { id: 'c15', category: 'car', location: 'Ulcinj', priceLabel: '€30/day', image: img('c15'), createdAt: '2026-03-08T11:45:00Z' },

  {
    id: 'm1',
    category: 'motorcycle',
    location: 'Kotor',
    priceLabel: '€28/day',
    image: img('m1'),
    createdAt: '2026-03-22T12:00:00Z',
    featured: true,
    verified: true,
  },
  { id: 'm2', category: 'motorcycle', location: 'Budva', priceLabel: '€25/day', image: img('m2'), createdAt: '2026-03-21T09:15:00Z', verified: true },
  { id: 'm3', category: 'motorcycle', location: 'Podgorica', priceLabel: '€22/day', image: img('m3'), createdAt: '2026-03-20T14:40:00Z' },
  { id: 'm4', category: 'motorcycle', location: 'Split', priceLabel: '€32/day', image: img('m4'), createdAt: '2026-03-19T11:00:00Z' },
  { id: 'm5', category: 'motorcycle', location: 'Dubrovnik', priceLabel: '€35/day', image: img('m5'), createdAt: '2026-03-18T08:20:00Z' },
  { id: 'm6', category: 'motorcycle', location: 'Bar', priceLabel: '€20/day', image: img('m6'), createdAt: '2026-03-17T16:00:00Z' },
  { id: 'm7', category: 'motorcycle', location: 'Tivat', priceLabel: '€30/day', image: img('m7'), createdAt: '2026-03-16T10:30:00Z' },
  { id: 'm8', category: 'motorcycle', location: 'Zadar', priceLabel: '€27/day', image: img('m8'), createdAt: '2026-03-15T12:12:00Z' },
  { id: 'm9', category: 'motorcycle', location: 'Mostar', priceLabel: '€24/day', image: img('m9'), createdAt: '2026-03-14T09:00:00Z' },
  { id: 'm10', category: 'motorcycle', location: 'Tirana', priceLabel: '€23/day', image: img('m10'), createdAt: '2026-03-13T15:45:00Z' },
  { id: 'm11', category: 'motorcycle', location: 'Bari', priceLabel: '€34/day', image: img('m11'), createdAt: '2026-03-12T11:11:00Z' },
  { id: 'm12', category: 'motorcycle', location: 'Beograd', priceLabel: '€21/day', image: img('m12'), createdAt: '2026-03-11T08:00:00Z' },
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
  return allListings.find((l) => l.id === id)
}

export function getSimilarListings(listing: Listing, limit = 8): Listing[] {
  return allListings
    .filter((l) => l.id !== listing.id && l.category === listing.category)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}

export function listingsByCategory(category: ListingCategory): Listing[] {
  return allListings
    .filter((l) => l.category === category)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

/** Demo oglasi + javni oglasi iz nacrta vlasnika (localStorage). */
export function listingsByCategoryMerged(category: ListingCategory): Listing[] {
  const base = listingsByCategory(category)
  const rows = getAllOwnerListingRows().filter((r) => r.category === category && r.publicListingId)
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
