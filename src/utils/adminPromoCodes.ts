/**
 * Tipovi i generator za admin promotivne kodove.
 * Izvor istine za listu i aktivacije je Supabase (`/api/admin-promo`, `/api/owner-promo-code`).
 */

import type { ListingCategory } from '../types'
import type { SearchCountryId } from '../data/cities/countryIds'
import { SEARCH_COUNTRY_IDS } from '../data/cities/countryIds'

export type PromoBenefitType = 'discount_percent' | 'free_month' | 'free_year' | 'free_forever'

export type AdminPromoCodeRecord = {
  id: string
  code: string
  type: PromoBenefitType
  /** Samo za discount_percent */
  discountPercent: number | null
  /** ISO datum (kraj dana) ili null = bez datuma */
  validUntil: string | null
  maxUses: number | null
  /** Prazno = sve zemlje */
  countries: SearchCountryId[]
  maxUsesPerCountry: number | null
  /** Prazno = sve kategorije */
  categories: ListingCategory[]
  /** Ako postoji, kod važi samo za ovog vlasnika */
  restrictedUserId: string | null
  note: string
  createdAt: string
  uses: number
  usesByCountry: Partial<Record<SearchCountryId, number>>
}

function randomSegment(len: number) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export function generatePromoCodeString(): string {
  return `RA-${randomSegment(4)}-${randomSegment(4)}`
}

export const ALL_PROMO_COUNTRIES: SearchCountryId[] = [...SEARCH_COUNTRY_IDS]
