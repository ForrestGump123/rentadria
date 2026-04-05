import type { TFunction } from 'i18next'
import type { Listing } from '../types'
import type { OwnerContact } from '../types/listingDetail'

/** Mora ostati usklađeno s `isAccommodationDraftListingId` u `accommodationDraft.ts`. */
function isOwnerDraftListingId(id: string): boolean {
  return (
    id === 'owner-draft-accommodation' ||
    id.startsWith('owner-draft-acc-') ||
    id.startsWith('owner-draft-car-') ||
    id.startsWith('owner-draft-moto-')
  )
}

/**
 * Učitava vlasničke kontakte tek nakon klika korisnika.
 * - Demo oglasi: brojevi u odvojenom chunku (`listingDetailDemoContacts`).
 * - Nacrti vlasnika: lazy import `accommodationDraft`.
 *
 * Napomena: napredni botovi mogu i dalje simulirati klik. Prava zaštita = API na serveru
 * (provjera sesije, rate limit, CAPTCHA, logovanje).
 */
export async function resolveListingPublicContacts(
  listing: Listing,
  t: TFunction,
  uiLang: string,
): Promise<OwnerContact[]> {
  if (isOwnerDraftListingId(listing.id)) {
    const draftMod = await import('../utils/accommodationDraft')
    const draft = draftMod.loadAccommodationDraftForPublicListingPage(listing.id)
    if (!draft) return []
    return draftMod.buildAccommodationDraftDetail(draft, t, uiLang, listing.id).publicContacts
  }

  const { getDemoOwnerContactsForListing } = await import('./listingDetailDemoContacts')
  return getDemoOwnerContactsForListing(listing)
}
