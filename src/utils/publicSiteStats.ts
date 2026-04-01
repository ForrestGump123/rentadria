import { listingsByCategoryMerged } from '../data/listings'
import type { ListingCategory } from '../types'
import { countryKeyForPublicListing } from './adminListingsIndex'

export type PublicSiteListingCounts = {
  accommodations: number
  cars: number
  motorcycles: number
  /** Broj različitih zemalja (iz drafta oglasa ili „, ISO“ u lokaciji) među svim javnim oglasima. */
  countries: number
}

const CATS: ListingCategory[] = ['accommodation', 'car', 'motorcycle']

export function getPublicSiteListingCounts(): PublicSiteListingCounts {
  const accommodations = listingsByCategoryMerged('accommodation').length
  const cars = listingsByCategoryMerged('car').length
  const motorcycles = listingsByCategoryMerged('motorcycle').length
  const seen = new Set<string>()
  for (const cat of CATS) {
    for (const l of listingsByCategoryMerged(cat)) {
      const k = countryKeyForPublicListing(l)
      if (k) seen.add(k)
    }
  }
  return {
    accommodations,
    cars,
    motorcycles,
    countries: seen.size,
  }
}
