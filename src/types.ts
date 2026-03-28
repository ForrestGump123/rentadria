export type ListingCategory = 'accommodation' | 'car' | 'motorcycle'

export interface Listing {
  id: string
  category: ListingCategory
  /** English fallback; use `listingTitle(listing, t)` for UI */
  title: string
  /** Index within same category (0-based), for i18n title pool */
  titleSlot: number
  location: string
  priceLabel: string
  image: string
  createdAt: string
  featured?: boolean
  /** Admin verified in person */
  verified?: boolean
  /** Smještaj: `propertyType` iz nacrta vlasnika (pretraga) */
  ownerPropertyType?: string
  /** Auto / moto: marka iz nacrta vlasnika (pretraga) */
  ownerVehicleMake?: string
}
