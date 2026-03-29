import type { ListingCategory } from '../types'

const KEY = 'rentadria_admin_owner_meta'

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
  }
}

export function loadAdminOwnerMetaMap(): Record<string, AdminOwnerMeta> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const j = JSON.parse(raw) as Record<string, Partial<AdminOwnerMeta>>
    const out: Record<string, AdminOwnerMeta> = {}
    for (const [uid, v] of Object.entries(j)) {
      const d = defaults()
      out[uid] = {
        ...d,
        ...v,
        extraListingsAcc: Math.max(0, Number(v.extraListingsAcc) || 0),
        extraListingsCar: Math.max(0, Number(v.extraListingsCar) || 0),
        extraListingsMoto: Math.max(0, Number(v.extraListingsMoto) || 0),
      }
    }
    return out
  } catch {
    return {}
  }
}

function saveAdminOwnerMetaMap(m: Record<string, AdminOwnerMeta>) {
  localStorage.setItem(KEY, JSON.stringify(m))
}

export function getAdminOwnerMeta(userId: string): AdminOwnerMeta {
  const m = loadAdminOwnerMetaMap()
  return m[userId] ?? defaults()
}

export function setAdminOwnerMeta(userId: string, meta: AdminOwnerMeta): void {
  const m = loadAdminOwnerMetaMap()
  m[userId] = { ...defaults(), ...meta }
  saveAdminOwnerMetaMap(m)
}

export function clearAdminOwnerMeta(userId: string): void {
  const m = loadAdminOwnerMetaMap()
  delete m[userId]
  saveAdminOwnerMetaMap(m)
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
