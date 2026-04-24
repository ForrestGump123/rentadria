import type { ListingCategory } from '../types'

export type AdminOwnerMeta = {
  xmlImportUrl?: string
  /** Naše polje → XML tag / putanja (opciono). */
  xmlFieldMapping?: Record<string, string>
  extraListingsAcc: number
  extraListingsCar: number
  extraListingsMoto: number
  extraCatAcc: boolean
  extraCatCar: boolean
  extraCatMoto: boolean
  blocked: boolean
  /** Ako je true, admin plan/istek prepisuje promo global Pro. */
  planOverride?: boolean
}

function defaults(): AdminOwnerMeta {
  return {
    extraListingsAcc: 0,
    extraListingsCar: 0,
    extraListingsMoto: 0,
    extraCatAcc: false,
    extraCatCar: false,
    extraCatMoto: false,
    blocked: false,
    planOverride: false,
  }
}

let inMemory: Record<string, AdminOwnerMeta> = {}

function normalize(v: Partial<AdminOwnerMeta> | null | undefined): AdminOwnerMeta {
  const d = defaults()
  const x = v ?? {}
  return {
    ...d,
    ...x,
    extraListingsAcc: Math.max(0, Number(x.extraListingsAcc) || 0),
    extraListingsCar: Math.max(0, Number(x.extraListingsCar) || 0),
    extraListingsMoto: Math.max(0, Number(x.extraListingsMoto) || 0),
    extraCatAcc: Boolean(x.extraCatAcc),
    extraCatCar: Boolean(x.extraCatCar),
    extraCatMoto: Boolean(x.extraCatMoto),
    blocked: Boolean(x.blocked),
    planOverride: Boolean(x.planOverride),
  }
}

export function replaceAdminOwnerMetaMap(next: Record<string, Partial<AdminOwnerMeta>>): void {
  const out: Record<string, AdminOwnerMeta> = {}
  for (const [uid, v] of Object.entries(next ?? {})) {
    out[uid] = normalize(v)
  }
  inMemory = out
  try {
    window.dispatchEvent(new Event('rentadria-admin-owner-meta-updated'))
  } catch {
    /* ignore */
  }
}

export function getAdminOwnerMeta(userId: string): AdminOwnerMeta {
  return inMemory[userId] ?? defaults()
}

export function setAdminOwnerMeta(userId: string, meta: AdminOwnerMeta): void {
  inMemory = { ...inMemory, [userId]: normalize(meta) }
  try {
    window.dispatchEvent(new Event('rentadria-admin-owner-meta-updated'))
  } catch {
    /* ignore */
  }
}

export function clearAdminOwnerMeta(userId: string): void {
  const next = { ...inMemory }
  delete next[userId]
  inMemory = next
  try {
    window.dispatchEvent(new Event('rentadria-admin-owner-meta-updated'))
  } catch {
    /* ignore */
  }
}

export function extraListingsForCategory(meta: AdminOwnerMeta, category: ListingCategory): number {
  if (category === 'accommodation') return meta.extraListingsAcc
  if (category === 'car') return meta.extraListingsCar
  return meta.extraListingsMoto
}

export function extraCategoryFlags(meta: AdminOwnerMeta): { accommodation: boolean; car: boolean; motorcycle: boolean } {
  return {
    accommodation: meta.extraCatAcc,
    car: meta.extraCatCar,
    motorcycle: meta.extraCatMoto,
  }
}
