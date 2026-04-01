import type { Listing } from '../types'
import type { SearchCountryId } from '../data/cities/countryIds'
import { SEARCH_COUNTRY_ISO } from '../data/cities/countryIds'

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

function listingCityPart(location: string): string {
  const i = location.indexOf(',')
  return i >= 0 ? location.slice(0, i).trim() : location.trim()
}

function hasCountrySuffix(location: string, iso: string): boolean {
  const m = location.match(/,\s*([A-Z]{2})\s*$/i)
  return !!m && m[1].toUpperCase() === iso
}

function locationMatchesCity(location: string, city: string): boolean {
  const a = fold(listingCityPart(location))
  const b = fold(city.trim())
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

/**
 * @param citiesReady — when false, listings without ", XX" are excluded (wait for city list load).
 */
export function filterListingsByLocation(
  items: Listing[],
  countryId: SearchCountryId | null,
  city: string | null,
  citiesForCountry: string[] | null,
  citiesReady: boolean,
): Listing[] {
  const cityTrim = city?.trim() ?? ''

  /** Bez odabrane države: slobodan tekst grad / mjesto u cijelom polju lokacije. */
  if (!countryId) {
    if (!cityTrim) return items
    return items.filter((item) => {
      const loc = item.location
      return locationMatchesCity(loc, cityTrim) || fold(loc).includes(fold(cityTrim))
    })
  }

  const iso = SEARCH_COUNTRY_ISO[countryId]

  return items.filter((item) => {
    const loc = item.location

    if (hasCountrySuffix(loc, iso)) {
      if (!cityTrim) return true
      return locationMatchesCity(loc, cityTrim)
    }

    if (!citiesReady) return false
    if (!citiesForCountry?.length) return false

    const inCountry = citiesForCountry.some((c) => locationMatchesCity(loc, c))
    if (!inCountry) return false
    if (!cityTrim) return true
    return locationMatchesCity(loc, cityTrim)
  })
}

/**
 * Početna: država (opciono), zatim ključna riječ u naslovu ili lokaciji (npr. „koto“ → Kotor u naslovu).
 */
export function filterHomeListings(
  items: Listing[],
  countryId: SearchCountryId | null,
  placeOrKeyword: string,
  citiesForCountry: string[] | null,
  citiesReady: boolean,
): Listing[] {
  const base = filterListingsByLocation(items, countryId, null, citiesForCountry, citiesReady)
  const q = placeOrKeyword.trim()
  if (!q) return base
  const fq = fold(q)
  return base.filter((item) => {
    if (fold(`${item.title} ${item.location}`).includes(fq)) return true
    if (fold(item.location).includes(fq)) return true
    return locationMatchesCity(item.location, q)
  })
}
