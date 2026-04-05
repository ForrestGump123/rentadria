/**
 * Admin promotivni kodovi (localStorage demo).
 * Sva ograničenja su opciona; prazna lista zemalja/kategorija = važi svuda u tom polju.
 */

import type { ListingCategory } from '../types'
import type { SearchCountryId } from '../data/cities/countryIds'
import { SEARCH_COUNTRY_IDS } from '../data/cities/countryIds'
import type { OwnerProfile } from './ownerSession'
import { addMonthsIso, addOneYearIso, getEffectiveUnlockedCategories } from './ownerSession'

const KEY = 'rentadria_admin_promo_codes_v1'

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

function load(): AdminPromoCodeRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const a = JSON.parse(raw) as unknown
    return Array.isArray(a) ? (a as AdminPromoCodeRecord[]) : []
  } catch {
    return []
  }
}

function save(rows: AdminPromoCodeRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(rows))
  try {
    window.dispatchEvent(new Event('rentadria-admin-promo-codes-updated'))
  } catch {
    /* ignore */
  }
}

export function listAdminPromoCodes(): AdminPromoCodeRecord[] {
  return load().slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getAdminPromoByCode(normalized: string): AdminPromoCodeRecord | undefined {
  const c = normalized.trim().toUpperCase()
  return load().find((x) => x.code === c)
}

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `promo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
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

export function addAdminPromoCode(row: Omit<AdminPromoCodeRecord, 'id' | 'createdAt' | 'uses' | 'usesByCountry'> & { id?: string }): AdminPromoCodeRecord {
  const list = load()
  const code = row.code.trim().toUpperCase()
  if (list.some((x) => x.code === code)) throw new Error('duplicate')
  const full: AdminPromoCodeRecord = {
    ...row,
    code,
    id: row.id ?? newId(),
    createdAt: new Date().toISOString(),
    uses: 0,
    usesByCountry: {},
  }
  list.unshift(full)
  save(list)
  return full
}

export function deleteAdminPromoCode(id: string): void {
  save(load().filter((x) => x.id !== id))
}

/** Zamijeni cijelu listu (npr. nakon učitavanja sa Supabase). */
export function replaceAdminPromoCodes(rows: AdminPromoCodeRecord[]): void {
  save(rows.slice())
}

/** Jedna uspješna aktivacija (vlasnik sačuva kod) — povećava brojače. */
export function incrementPromoUses(recordId: string, country: SearchCountryId | undefined): void {
  const list = load()
  const i = list.findIndex((x) => x.id === recordId)
  if (i < 0) return
  const r = list[i]!
  const next: AdminPromoCodeRecord = {
    ...r,
    uses: r.uses + 1,
    usesByCountry: {
      ...r.usesByCountry,
      ...(country ? { [country]: (r.usesByCountry[country] ?? 0) + 1 } : {}),
    },
  }
  list[i] = next
  save(list)
}

export type PromoValidationFail =
  | 'empty'
  | 'unknown'
  | 'restricted'
  | 'expired'
  | 'max_uses'
  | 'country'
  | 'max_per_country'
  | 'category'

export type ValidatePromoResult =
  | { ok: true; record: AdminPromoCodeRecord }
  | { ok: false; reason: PromoValidationFail }

function hasActivePaidPlan(profile: OwnerProfile): boolean {
  return profile.subscriptionActive === true && profile.plan != null
}

function endOfValidDayIso(isoYmd: string): string {
  const d = new Date(isoYmd.includes('T') ? isoYmd : `${isoYmd}T12:00:00`)
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

function earlierIso(a: string, b: string): string {
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b
}

/**
 * Primjenjuje admin pravila (besplatna godina, itd.) na profil — poziva se nakon validacije koda.
 */
export function applyPromoSubscriptionToProfile(
  profile: OwnerProfile,
  record: AdminPromoCodeRecord,
): OwnerProfile {
  const now = new Date()
  const cap = record.validUntil ? endOfValidDayIso(record.validUntil) : null
  /** Prazna lista u adminu = sve kategorije; inače samo označene (npr. samo moto). */
  const promoCategoryScope = record.categories.length > 0 ? [...record.categories] : undefined

  switch (record.type) {
    case 'free_forever':
      return {
        ...profile,
        plan: 'pro',
        subscriptionActive: true,
        validUntil: '2099-12-31T23:59:59.999Z',
        basicCategoryChoice: undefined,
        promoCategoryScope,
      }
    case 'free_year': {
      const yearEnd = addOneYearIso(now)
      const vu = cap ? earlierIso(yearEnd, cap) : yearEnd
      return {
        ...profile,
        plan: 'pro',
        subscriptionActive: true,
        validUntil: vu,
        basicCategoryChoice: undefined,
        promoCategoryScope,
      }
    }
    case 'free_month': {
      const monthEnd = addMonthsIso(1, now)
      const vu = cap ? earlierIso(monthEnd, cap) : monthEnd
      return {
        ...profile,
        plan: 'pro',
        subscriptionActive: true,
        validUntil: vu,
        basicCategoryChoice: undefined,
        promoCategoryScope,
      }
    }
    case 'discount_percent':
    default:
      return {
        ...profile,
        plan: 'pro',
        subscriptionActive: true,
        validUntil: cap ?? addOneYearIso(now),
        basicCategoryChoice: undefined,
        promoCategoryScope,
      }
  }
}

/** Validacija kada već imamo zapis koda (lokalno ili sa servera). */
export function validatePromoRecordForOwner(
  record: AdminPromoCodeRecord,
  profile: OwnerProfile,
): ValidatePromoResult {
  if (record.restrictedUserId && record.restrictedUserId !== profile.userId) {
    return { ok: false, reason: 'restricted' }
  }

  const now = Date.now()
  if (record.validUntil) {
    const end = new Date(record.validUntil)
    end.setHours(23, 59, 59, 999)
    if (now > end.getTime()) return { ok: false, reason: 'expired' }
  }

  if (record.maxUses != null && record.uses >= record.maxUses) {
    return { ok: false, reason: 'max_uses' }
  }

  const ownerCountry = profile.countryId
  if (record.countries.length > 0) {
    if (!ownerCountry || !record.countries.includes(ownerCountry)) {
      return { ok: false, reason: 'country' }
    }
  }

  if (record.maxUsesPerCountry != null && ownerCountry) {
    const u = record.usesByCountry[ownerCountry] ?? 0
    if (u >= record.maxUsesPerCountry) return { ok: false, reason: 'max_per_country' }
  }

  /** Nova registracija: još nema plana — ne tražimo preklapanje kategorija; kod otključuje sve iz admin forme. */
  if (record.categories.length > 0 && hasActivePaidPlan(profile)) {
    const unlocked = getEffectiveUnlockedCategories(profile)
    const okCat = record.categories.some((c) => unlocked.includes(c))
    if (!okCat) return { ok: false, reason: 'category' }
  }

  return { ok: true, record }
}

/** Provjera da li vlasnik smije koristiti kod (prije snimanja u profil). */
export function validateAdminPromoForOwner(
  rawCode: string,
  profile: OwnerProfile,
): ValidatePromoResult {
  const normalized = rawCode.trim().toUpperCase().replace(/\s+/g, '')
  if (!normalized) return { ok: false, reason: 'empty' }

  const record = getAdminPromoByCode(normalized)
  if (!record) return { ok: false, reason: 'unknown' }

  return validatePromoRecordForOwner(record, profile)
}

export const ALL_PROMO_COUNTRIES: SearchCountryId[] = [...SEARCH_COUNTRY_IDS]
