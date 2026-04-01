import { LISTING_IMAGE_FALLBACK } from '../data/listings'
import type { Listing, ListingCategory } from '../types'
import type { AdminBannerItem } from './adminBannersStore'

export const ADMIN_PROMO_LISTING_PREFIX = '__ad__' as const

export function isAdminPromoListingId(id: string): boolean {
  return id.startsWith(ADMIN_PROMO_LISTING_PREFIX)
}

/** Pretvara admin baner u „Listing“ za hero / bočne kolone (klik ne vodi na oglas). */
export function adminBannerToListing(b: AdminBannerItem, category: ListingCategory): Listing {
  return {
    id: `${ADMIN_PROMO_LISTING_PREFIX}${b.id}`,
    category,
    title: b.title,
    titleSlot: 0,
    location: b.description.trim() || '—',
    priceLabel: '',
    image: b.imageDataUrl?.trim() ? b.imageDataUrl : LISTING_IMAGE_FALLBACK,
    createdAt: new Date().toISOString(),
  }
}

export function adminBannersToListings(banners: AdminBannerItem[], category: ListingCategory): Listing[] {
  return banners.map((b) => adminBannerToListing(b, category))
}
