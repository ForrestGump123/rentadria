import type { TFunction } from 'i18next'
import { allListings, getListingById } from '../data/listings'
import type { SearchCountryId } from '../data/cities/countryIds'
import { SEARCH_COUNTRY_IDS, SEARCH_COUNTRY_ISO } from '../data/cities/countryIds'
import type { Listing, ListingCategory } from '../types'
import type { OwnerListingRow } from './ownerSession'
import { deleteOwnerListing, getAllOwnerListingRows } from './ownerSession'
import type { AccommodationListingDraft } from './accommodationDraft'
import { loadAccommodationDraftForPublicListingPage } from './accommodationDraft'
import {
  ACCOMMODATION_DRAFT_LS_KEY,
  CAR_DRAFT_LS_KEY,
  MOTO_DRAFT_LS_KEY,
} from './accommodationDraft'
import { listingTitle } from './listingTitle'

export type AdminListingRow = {
  /** Stabilan redni broj u globalnom sortu (ne mijenja se pri filtriranju). */
  numericId: number
  listingId: string
  listing: Listing
  title: string
  category: ListingCategory
  ownerUserId: string
  ownerDisplayName: string
  ownerIdSlug: string
  /** Za padajući filter (samo zemlje iz pretrage). */
  countryKey: SearchCountryId | null
  priceDisplay: string
  searchBlob: string
  isOwnerListing: boolean
  ownerRow: OwnerListingRow | null
  createdAt: string
}

export function ownerIdSlug(userId: string): string {
  const s = userId
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
  return s || 'owner'
}

function countryKeyFromLocation(location: string): SearchCountryId | null {
  const m = /,\s*([A-Z]{2})\s*$/.exec(location.trim())
  if (!m) return null
  const iso = m[1]
  const e = (Object.entries(SEARCH_COUNTRY_ISO) as [SearchCountryId, string][]).find(
    ([, v]) => v === iso,
  )
  return e ? e[0] : null
}

function countryKeyForListing(
  _listingId: string,
  location: string,
  draft: AccommodationListingDraft | null,
): SearchCountryId | null {
  const cid = draft?.countryId
  if (cid && (SEARCH_COUNTRY_IDS as readonly string[]).includes(cid)) {
    return cid as SearchCountryId
  }
  return countryKeyFromLocation(location)
}

function ownerNameFromDraft(d: AccommodationListingDraft | null, userId: string): string {
  const o = d?.contacts?.find((c) => c.type === 'owner')
  if (o) {
    const n = `${o.firstName} ${o.lastName}`.trim()
    if (n) return n
  }
  if (userId.includes('@')) {
    const p = userId.split('@')[0]?.trim()
    if (p) return p
  }
  return userId || '—'
}

function draftSearchBlob(d: AccommodationListingDraft | null): string {
  if (!d?.contacts?.length) return ''
  return d.contacts
    .map((c) =>
      [c.email, c.phone, c.firstName, c.lastName, c.whatsapp, c.viber, c.telegram].filter(Boolean).join(' '),
    )
    .join(' ')
}

function buildSearchBlob(parts: (string | undefined)[]): string {
  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function buildMockRow(l: Listing, t: TFunction): AdminListingRow {
  const title = listingTitle(l, t)
  const draft = loadAccommodationDraftForPublicListingPage(l.id)
  const ck = countryKeyForListing(l.id, l.location, draft)
  const ownerUserId = 'mock'
  const slug = ownerIdSlug(ownerUserId)
  const searchBlob = buildSearchBlob([
    l.id,
    title,
    ownerUserId,
    slug,
    'mock',
    draftSearchBlob(draft),
  ])
  return {
    numericId: 0,
    listingId: l.id,
    listing: l,
    title,
    category: l.category,
    ownerUserId,
    ownerDisplayName: t('admin.listings.mockOwner'),
    ownerIdSlug: slug,
    countryKey: ck,
    priceDisplay: l.priceLabel,
    searchBlob,
    isOwnerListing: false,
    ownerRow: null,
    createdAt: l.createdAt,
  }
}

function buildOwnerRow(
  l: Listing,
  row: OwnerListingRow,
  t: TFunction,
): AdminListingRow {
  const draft = loadAccommodationDraftForPublicListingPage(l.id)
  const title = listingTitle(l, t)
  const ownerDisplayName = ownerNameFromDraft(draft, row.userId)
  const slug = ownerIdSlug(row.userId)
  const ck = countryKeyForListing(l.id, l.location, draft)
  const searchBlob = buildSearchBlob([
    l.id,
    title,
    row.userId,
    row.title,
    ownerDisplayName,
    slug,
    draftSearchBlob(draft),
    row.userId.includes('@') ? row.userId : '',
  ])
  return {
    numericId: 0,
    listingId: l.id,
    listing: l,
    title,
    category: l.category,
    ownerUserId: row.userId,
    ownerDisplayName,
    ownerIdSlug: slug,
    countryKey: ck,
    priceDisplay: l.priceLabel,
    searchBlob,
    isOwnerListing: true,
    ownerRow: row,
    createdAt: l.createdAt,
  }
}

/** Svi oglasi (demo + vlasnici), sort po datumu, numerisano. */
export function buildAdminListingIndex(t: TFunction): AdminListingRow[] {
  const map = new Map<string, AdminListingRow>()
  for (const l of allListings) {
    map.set(l.id, buildMockRow(l, t))
  }
  for (const row of getAllOwnerListingRows()) {
    const pid = row.publicListingId
    if (!pid) continue
    const l = getListingById(pid)
    if (!l) continue
    map.set(l.id, buildOwnerRow(l, row, t))
  }
  const rows = [...map.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  rows.forEach((r, i) => {
    r.numericId = i + 1
  })
  return rows
}

export function removeOwnerListingDraftLs(rowId: string, category: ListingCategory): void {
  try {
    if (category === 'accommodation') {
      localStorage.removeItem(`${ACCOMMODATION_DRAFT_LS_KEY}::${rowId}`)
    } else if (category === 'car') {
      localStorage.removeItem(`${CAR_DRAFT_LS_KEY}::${rowId}`)
    } else {
      localStorage.removeItem(`${MOTO_DRAFT_LS_KEY}::${rowId}`)
    }
  } catch {
    /* ignore */
  }
}

export function adminDeleteOwnerListing(userId: string, row: OwnerListingRow): void {
  deleteOwnerListing(userId, row.id)
  removeOwnerListingDraftLs(row.id, row.category)
}
