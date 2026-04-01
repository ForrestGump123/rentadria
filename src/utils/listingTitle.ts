import type { TFunction } from 'i18next'
import type { Listing } from '../types'
import { isAccommodationDraftListingId } from './accommodationDraft'
import { isAdminPromoListingId } from './adminBannerListings'

/** Localized listing headline (grid, detail, modals, similar). */
export function listingTitle(listing: Listing, t: TFunction): string {
  if (isAdminPromoListingId(listing.id)) return listing.title
  if (isAccommodationDraftListingId(listing.id)) return listing.title
  const names = t(`listingTitles.${listing.category}`, { returnObjects: true })
  if (!Array.isArray(names) || names.length === 0) return listing.title
  const slot = listing.titleSlot % names.length
  const n = listing.titleSlot + 1
  return `${names[slot]} · #${n}`
}
