import { deleteAdminBannerObjectAtUrl } from './adminBannerImageStorage.js'
import { getSupabaseAdmin } from './supabaseAdmin.js'

const TABLE = 'rentadria_admin_banners'

/** Iste kao pretraga na sajtu / admin reklamama */
const ALLOWED_COUNTRIES = new Set(['al', 'ba', 'me', 'hr', 'it', 'rs', 'es'])

const MAX_IMAGE_DATA_URL_CHARS = 1_400_000

function normalizeCountries(input: string[]): string[] {
  const out: string[] = []
  for (const c of input) {
    if (typeof c !== 'string') continue
    const x = c.trim().toLowerCase()
    if (ALLOWED_COUNTRIES.has(x)) out.push(x)
  }
  return out
}

export type AdminBannerSlot = 'slideshow' | 'left' | 'right' | 'popup'

export type AdminBannerRow = {
  id: string
  slot: AdminBannerSlot
  title: string
  description: string
  /** Javni URL (Storage); prednost pred imageDataUrl. */
  imageUrl: string | null
  imageDataUrl: string | null
  countries: string[]
  startDate: string | null
  endDate: string | null
  createdAt: string
  updatedAt: string
}

function slotOk(v: unknown): v is AdminBannerSlot {
  return v === 'slideshow' || v === 'left' || v === 'right' || v === 'popup'
}

function rowToApi(r: Record<string, unknown>): AdminBannerRow | null {
  const id = typeof r.id === 'string' ? r.id : ''
  const slot = r.slot
  if (!id || !slotOk(slot)) return null
  const countriesRaw = r.countries
  const countries = Array.isArray(countriesRaw)
    ? normalizeCountries(countriesRaw.filter((x): x is string => typeof x === 'string'))
    : []
  const imageUrl = typeof r.image_url === 'string' && r.image_url.trim() ? String(r.image_url).trim() : null
  const imageDataUrlRaw =
    typeof r.image_data_url === 'string' && r.image_data_url.trim() ? String(r.image_data_url).trim() : null
  /** Ne šaljemo ogroman legacy blob ako već postoji URL. */
  const imageDataUrl = imageUrl ? null : imageDataUrlRaw
  const startDate = typeof r.start_date === 'string' && r.start_date.trim() ? String(r.start_date) : null
  const endDate = typeof r.end_date === 'string' && r.end_date.trim() ? String(r.end_date) : null
  const createdAt = typeof r.created_at === 'string' ? new Date(r.created_at).toISOString() : new Date().toISOString()
  const updatedAt = typeof r.updated_at === 'string' ? new Date(r.updated_at).toISOString() : createdAt
  return {
    id,
    slot,
    title: typeof r.title === 'string' ? r.title : '',
    description: typeof r.description === 'string' ? r.description : '',
    imageUrl,
    imageDataUrl,
    countries,
    startDate,
    endDate,
    createdAt,
    updatedAt,
  }
}

export async function listAdminBanners(): Promise<AdminBannerRow[] | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const { data, error } = await sb.from(TABLE).select('*').order('created_at', { ascending: false }).limit(2000)
  if (error || !Array.isArray(data)) return null
  const out: AdminBannerRow[] = []
  for (const raw of data) {
    const m = rowToApi(raw as Record<string, unknown>)
    if (m) out.push(m)
  }
  return out
}

export async function upsertAdminBanner(input: {
  id?: string | null
  slot: AdminBannerSlot
  title: string
  description: string
  /** Nova slika (Storage URL). */
  imageUrl?: string
  /** Samo mali legacy unos (inače koristiti upload endpoint). */
  imageDataUrl?: string | null
  removeImage?: boolean
  countries: string[]
  startDate: string | null
  endDate: string | null
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const sb = getSupabaseAdmin()
  if (!sb) return { ok: false, error: 'no_backend' }

  const removeImage = Boolean(input.removeImage)
  const hasNewUrl = typeof input.imageUrl === 'string' && input.imageUrl.trim().length > 0
  const dataRaw = typeof input.imageDataUrl === 'string' && input.imageDataUrl.trim() ? input.imageDataUrl.trim() : ''
  const hasNewData = dataRaw.length > 0

  if (hasNewData && dataRaw.length > MAX_IMAGE_DATA_URL_CHARS) {
    return { ok: false, error: 'image_too_large' }
  }

  const uid = typeof input.id === 'string' && input.id.trim() ? input.id.trim() : null

  let image_url: string | null = null
  let image_data_url: string | null = null

  if (removeImage) {
    if (uid) {
      const { data: ex } = await sb.from(TABLE).select('image_url').eq('id', uid).maybeSingle()
      const oldU = typeof (ex as { image_url?: unknown } | null)?.image_url === 'string' ? (ex as { image_url: string }).image_url : ''
      if (oldU.trim()) await deleteAdminBannerObjectAtUrl(oldU.trim())
    }
    image_url = null
    image_data_url = null
  } else if (hasNewUrl) {
    const nextU = input.imageUrl!.trim()
    if (uid) {
      const { data: ex } = await sb.from(TABLE).select('image_url').eq('id', uid).maybeSingle()
      const oldU = typeof (ex as { image_url?: unknown } | null)?.image_url === 'string' ? (ex as { image_url: string }).image_url.trim() : ''
      if (oldU && oldU !== nextU) await deleteAdminBannerObjectAtUrl(oldU)
    }
    image_url = nextU
    image_data_url = null
  } else if (hasNewData) {
    image_data_url = dataRaw
    image_url = null
  } else if (uid) {
    const { data: ex } = await sb.from(TABLE).select('image_url, image_data_url').eq('id', uid).maybeSingle()
    const rec = ex as Record<string, unknown> | null
    const prevUrl = typeof rec?.image_url === 'string' && rec.image_url.trim() ? String(rec.image_url).trim() : null
    const prevData =
      typeof rec?.image_data_url === 'string' && rec.image_data_url.trim() ? String(rec.image_data_url).trim() : null
    image_url = prevUrl
    image_data_url = prevUrl ? null : prevData
  }

  const countries = normalizeCountries(input.countries ?? [])

  const row: Record<string, unknown> = {
    ...(uid ? { id: uid } : {}),
    slot: input.slot,
    title: input.title,
    description: input.description,
    image_url,
    image_data_url,
    countries,
    start_date: input.startDate,
    end_date: input.endDate,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await sb.from(TABLE).upsert(row, { onConflict: 'id' }).select('id').maybeSingle()
  if (error) return { ok: false, error: error.message }
  const idOut = (data as { id?: unknown } | null)?.id
  return { ok: true, id: typeof idOut === 'string' ? idOut : uid ?? undefined }
}

export async function deleteAdminBanner(id: string): Promise<boolean> {
  const sb = getSupabaseAdmin()
  if (!sb) return false
  const uid = id.trim()
  const { data: ex } = await sb.from(TABLE).select('image_url').eq('id', uid).maybeSingle()
  const url = typeof (ex as { image_url?: unknown } | null)?.image_url === 'string' ? (ex as { image_url: string }).image_url : ''
  if (url.trim()) await deleteAdminBannerObjectAtUrl(url.trim())
  const { error } = await sb.from(TABLE).delete().eq('id', uid)
  return !error
}
