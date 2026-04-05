import type { TFunction } from 'i18next'
import type { Listing, ListingCategory } from '../types'
import { resolveListingPublicContacts } from '../data/listingContactResolve'
import { listingTitle } from './listingTitle'

const CATEGORY_TAIL_ICON: Record<ListingCategory, string> = {
  accommodation: '🏠',
  car: '🚗',
  motorcycle: '🏍️',
}

/** Javni URL oglasa (bez hash-a) — isto kao u routeru. */
export function listingPublicUrl(siteBaseUrl: string, listingId: string): string {
  const base = siteBaseUrl.replace(/\/$/, '')
  return `${base}/listing/${encodeURIComponent(listingId)}`
}

/**
 * Tekstualni opis (caption) za Instagram — univerzalni šablon.
 * - `titleDisplay`: kao na sajtu (`listingTitle` ili naslov oglasa).
 * - `ownerPhoneDisplay`: broj s oglasa; ako nema (npr. API bez klika), koristi se placeholder iz i18n.
 */
export function buildInstagramListingCaption(opts: {
  t: TFunction
  category: ListingCategory
  titleDisplay: string
  listingId: string
  siteBaseUrl: string
  ownerPhoneDisplay?: string | null
}): string {
  const url = listingPublicUrl(opts.siteBaseUrl, opts.listingId)
  const phone =
    opts.ownerPhoneDisplay?.trim() || opts.t('instagram.captionPhonePlaceholder')
  const titleLine = opts.t('instagram.captionLine1', {
    title: opts.titleDisplay.toUpperCase(),
    icon: CATEGORY_TAIL_ICON[opts.category],
  })

  return [
    titleLine,
    '',
    opts.t('instagram.captionBody'),
    '',
    opts.t('instagram.captionLineUrl', { url }),
    opts.t('instagram.captionLinePhone', { phone }),
    '',
    opts.t('instagram.captionHashtags'),
  ].join('\n')
}

/** U browseru: učitava demo/nacrt kontakte i sklapa caption (za pregled / kasniji API prototip). */
export async function buildInstagramCaptionForListing(
  listing: Listing,
  t: TFunction,
  uiLang: string,
  siteBaseUrl: string,
): Promise<string> {
  const contacts = await resolveListingPublicContacts(listing, t, uiLang)
  const phone = contacts[0]?.phones[0]?.display?.trim() ?? null
  return buildInstagramListingCaption({
    t,
    category: listing.category,
    titleDisplay: listingTitle(listing, t),
    listingId: listing.id,
    siteBaseUrl,
    ownerPhoneDisplay: phone,
  })
}
