import type { SearchCountryId } from '../data/cities/countryIds'
import { SEARCH_COUNTRY_IDS } from '../data/cities/countryIds'

const KEY = 'rentadria_admin_banners_v1'

export type BannerSlot = 'slideshow' | 'left' | 'right' | 'popup'

export type AdminBannerItem = {
  id: string
  slot: BannerSlot
  title: string
  description: string
  imageDataUrl: string | null
  /** Prazno = sve zemlje */
  countries: SearchCountryId[]
}

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `b-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function load(): AdminBannerItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const a = JSON.parse(raw) as unknown
    return Array.isArray(a) ? (a as AdminBannerItem[]) : []
  } catch {
    return []
  }
}

function save(rows: AdminBannerItem[]) {
  localStorage.setItem(KEY, JSON.stringify(rows))
  try {
    window.dispatchEvent(new Event('rentadria-admin-banners-updated'))
  } catch {
    /* ignore */
  }
}

export function listBanners(): AdminBannerItem[] {
  return load().slice()
}

export function addBanner(row: Omit<AdminBannerItem, 'id'>): AdminBannerItem {
  const full: AdminBannerItem = { ...row, id: newId() }
  const list = load()
  list.push(full)
  save(list)
  return full
}

export function updateBanner(id: string, patch: Partial<Omit<AdminBannerItem, 'id'>>): void {
  const list = load()
  const i = list.findIndex((x) => x.id === id)
  if (i < 0) return
  list[i] = { ...list[i]!, ...patch, id }
  save(list)
}

export function deleteBanner(id: string): void {
  save(load().filter((x) => x.id !== id))
}

/** Za checkbox „sve zemlje“: sva tri slova ili prazno = sve */
export function allCountriesSelected(countries: SearchCountryId[]): boolean {
  return countries.length === 0 || countries.length >= SEARCH_COUNTRY_IDS.length
}
