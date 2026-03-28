import type { Listing, ListingCategory } from '../types'

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

/**
 * Dodatni filteri: vrsta nekretnine (smještaj), marka (auto/moto).
 * Prazan string = ne filtriraj po tom polju.
 */
export function filterListingsBySearchFacets(
  items: Listing[],
  category: ListingCategory,
  propertyType: string,
  make: string,
): Listing[] {
  const pt = propertyType.trim()
  const mk = make.trim()
  if (!pt && !mk) return items

  return items.filter((item) => {
    if (category === 'accommodation' && pt) {
      const v = item.ownerPropertyType?.trim()
      if (!v) return false
      const fa = fold(v)
      const fb = fold(pt)
      return fa === fb || fa.includes(fb) || fb.includes(fa)
    }
    if ((category === 'car' || category === 'motorcycle') && mk) {
      const v = item.ownerVehicleMake?.trim()
      if (!v) return false
      const fa = fold(v)
      const fb = fold(mk)
      return fa === fb || fa.includes(fb) || fb.includes(fa)
    }
    return true
  })
}
