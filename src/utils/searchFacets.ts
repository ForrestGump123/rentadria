import type { Listing, ListingCategory } from '../types'

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

/** Kad nacrt nema `ownerPropertyType`, pokušaj iz naslova/lokacije (stariji oglasi). */
function inferPropertyTypeFromListing(item: Listing): string | undefined {
  if (item.category !== 'accommodation') return undefined
  const t = fold(`${item.title} ${item.location}`)
  if (t.includes('studio') || t.includes('студио') || t.includes('studij')) return 'studio'
  if (
    t.includes('jednosoban') ||
    t.includes('dvosoban') ||
    t.includes('trosoban') ||
    t.includes('četvorosoban') ||
    t.includes('cetvorosoban') ||
    t.includes('apartment') ||
    t.includes('stan') ||
    t.includes('apartman') ||
    t.includes('flat') ||
    t.includes('penthouse')
  ) {
    return 'apartment'
  }
  if (/\bsoba\b/.test(t) || /\brooms?\b/.test(t) || t.includes('habitacion') || t.includes('chambre')) return 'room'
  if (t.includes('villa') || t.includes('vila')) return 'villa'
  if (t.includes('house') || t.includes('kuća') || t.includes('kuca') || t.includes('cottage')) return 'house'
  if (t.includes('hostel')) return 'hostel'
  if (t.includes('hotel')) return 'hotel'
  return undefined
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
      const v = item.ownerPropertyType?.trim() || inferPropertyTypeFromListing(item)
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
