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
  /** ISO yyyy-mm-dd; prazno = bez ograničenja */
  startDate?: string
  /** ISO yyyy-mm-dd; prazno = bez ograničenja */
  endDate?: string
}

/** Kalendarski dan u lokalnoj zoni (bez UTC pomaka za sam datum). */
function parseYmdLocal(ymd: string | undefined): number | null {
  const s = ymd?.trim()
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null
  return new Date(y, mo, d).getTime()
}

/** Je li reklama aktivna na danasnji dan (uključivo start/end). */
export function bannerActiveOnDate(b: AdminBannerItem, now = new Date()): boolean {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const start = parseYmdLocal(b.startDate)
  const end = parseYmdLocal(b.endDate)
  if (start !== null && today < start) return false
  if (end !== null && today > end) return false
  return true
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

/**
 * Prazan `countries` = prikaži u svim zemljama.
 * Ako je odabrana zemlja u pretrazi, prikaži globalne + one čija lista sadrži tu zemlju.
 * Ako zemlja nije odabrana, prikaži sve (da prvi posjet ne bude prazan).
 */
export function bannerVisibleInCountry(
  b: AdminBannerItem,
  searchCountryId: SearchCountryId | null,
): boolean {
  if (b.countries.length === 0) return true
  if (!searchCountryId) return true
  return b.countries.includes(searchCountryId)
}

export function listBannersForSlot(
  slot: BannerSlot,
  searchCountryId: SearchCountryId | null,
): AdminBannerItem[] {
  return load().filter(
    (b) =>
      b.slot === slot &&
      bannerVisibleInCountry(b, searchCountryId) &&
      bannerActiveOnDate(b),
  )
}
