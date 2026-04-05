import type { Listing } from '../types'
import type { OwnerContact } from '../types/listingDetail'
import { listingHashFromId } from './listingDetail'

/**
 * Demo kontakti za statičke oglase — samo u lazy chunku, učitava se na „Prikaži kontakt“.
 * U produkciji zamijeniti odgovorom sa servera (API nakon klika + rate limit).
 */
export function getDemoOwnerContactsForListing(listing: Listing): OwnerContact[] {
  const h = listingHashFromId(listing.id)
  const phones: { display: string; e164: string }[] = [
    { display: '+382 69 123 456', e164: '+38269123456' },
  ]
  if (h % 5 === 0) {
    phones.push({ display: '+382 68 999 001', e164: '+38268999001' })
  }
  return [
    {
      displayName: 'Milan Petrović',
      email: 'owner.example@rentadria.com',
      phones,
      telegram: 'milan_rent',
    },
  ]
}
