import { SEARCH_COUNTRY_IDS, type SearchCountryId } from '../data/cities/countryIds'
import type { AdminBannerItem, BannerSlot } from '../utils/adminBannersStore'

const JSON_HDR = { 'Content-Type': 'application/json' } as const

const COUNTRY_OK = new Set<string>(SEARCH_COUNTRY_IDS)

export function parseAdminBannersArray(raw: unknown): AdminBannerItem[] | null {
  if (!Array.isArray(raw)) return null
  const out: AdminBannerItem[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const b = item as Record<string, unknown>
    const id = typeof b.id === 'string' ? b.id : ''
    const slot = typeof b.slot === 'string' ? b.slot : ''
    if (!id || (slot !== 'slideshow' && slot !== 'left' && slot !== 'right' && slot !== 'popup')) continue
    const countriesRaw = Array.isArray(b.countries) ? b.countries : []
    const countries = countriesRaw.filter(
      (x): x is SearchCountryId => typeof x === 'string' && COUNTRY_OK.has(x),
    )
      const imageUrl = typeof b.imageUrl === 'string' && b.imageUrl.trim() ? b.imageUrl.trim() : null
      out.push({
        id,
        slot: slot as BannerSlot,
        title: typeof b.title === 'string' ? b.title : '',
        description: typeof b.description === 'string' ? b.description : '',
        imageUrl,
        imageDataUrl: typeof b.imageDataUrl === 'string' ? b.imageDataUrl : null,
        countries,
      startDate: typeof b.startDate === 'string' ? b.startDate : undefined,
      endDate: typeof b.endDate === 'string' ? b.endDate : undefined,
    })
  }
  return out
}

export async function fetchAdminBanners(): Promise<AdminBannerItem[] | null> {
  try {
    const r = await fetch('/api/admin-banners', { credentials: 'include' })
    const j = (await r.json()) as { ok?: boolean; banners?: unknown }
    if (!r.ok || !j.ok) return null
    return parseAdminBannersArray(j.banners)
  } catch {
    return null
  }
}

/** Javni endpoint — puni keš na početnoj za sve posjetioce. */
export async function fetchPublicBanners(): Promise<AdminBannerItem[] | null> {
  try {
    const r = await fetch('/api/banners')
    const j = (await r.json()) as { ok?: boolean; banners?: unknown }
    if (!r.ok || !j.ok) return null
    return parseAdminBannersArray(j.banners)
  } catch {
    return null
  }
}

/** Upload slike (WebP u bucket); ne upisuje red u bazi. */
export async function uploadAdminBannerImageViaApi(imageDataUrl: string): Promise<string | null> {
  try {
    const r = await fetch('/api/admin-banner-upload', {
      method: 'POST',
      credentials: 'include',
      headers: JSON_HDR,
      body: JSON.stringify({ imageDataUrl }),
    })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; imageUrl?: string; error?: string }
    if (!r.ok || !j.ok || typeof j.imageUrl !== 'string' || !j.imageUrl.trim()) return null
    return j.imageUrl.trim()
  } catch {
    return null
  }
}

export async function upsertAdminBannerOnServer(row: {
  id?: string | null
  slot: BannerSlot
  title: string
  description: string
  imageUrl?: string
  imageDataUrl?: string | null
  removeImage?: boolean
  countries: string[]
  startDate?: string
  endDate?: string
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const body: Record<string, unknown> = {
      id: row.id ?? null,
      slot: row.slot,
      title: row.title,
      description: row.description,
      countries: row.countries,
      startDate: row.startDate ?? null,
      endDate: row.endDate ?? null,
      removeImage: row.removeImage === true,
    }
    if (row.imageUrl?.trim()) body.imageUrl = row.imageUrl.trim()
    if (row.imageDataUrl !== undefined && row.imageDataUrl !== null && row.imageDataUrl.trim()) {
      body.imageDataUrl = row.imageDataUrl.trim()
    }
    const r = await fetch('/api/admin-banners', {
      method: 'POST',
      credentials: 'include',
      headers: JSON_HDR,
      body: JSON.stringify(body),
    })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string }
    return { ok: r.ok && j.ok === true, id: j.id, error: j.error }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function deleteAdminBannerOnServer(id: string): Promise<boolean> {
  try {
    const q = new URLSearchParams({ id })
    const r = await fetch(`/api/admin-banners?${q}`, { method: 'DELETE', credentials: 'include' })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean }
    return r.ok && j.ok === true
  } catch {
    return false
  }
}
