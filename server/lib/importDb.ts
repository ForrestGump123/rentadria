import type { ListingCategory } from '../../src/types.js'
import { getSupabaseAdmin } from './supabaseAdmin.js'

export type SyncPartnerRow = {
  id: string
  name: string
  baseUrl: string
  apiKey?: string
  categories: Record<ListingCategory, boolean>
  createdAt: string
  updatedAt: string
}

export type ImportOwnerSettingsRow = {
  ownerUserId: string
  feedUrl: string | null
  fieldMapping: Record<string, string>
  updatedAt: string
}

export type SyncJobRow = {
  id: string
  at: string
  scope: 'owner' | 'site'
  ownerUserId: string | null
  partnerId: string | null
  categories: ListingCategory[]
  status: 'ok' | 'error'
  message: string
}

const VALID_CAT = new Set<ListingCategory>(['accommodation', 'car', 'motorcycle'])

function parseCats(raw: unknown): Record<ListingCategory, boolean> {
  const base: Record<ListingCategory, boolean> = { accommodation: true, car: true, motorcycle: true }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  const o = raw as Record<string, unknown>
  const out: Record<ListingCategory, boolean> = { accommodation: Boolean(o.accommodation), car: Boolean(o.car), motorcycle: Boolean(o.motorcycle) }
  return out
}

function parseCatArray(raw: unknown): ListingCategory[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is ListingCategory => typeof x === 'string' && VALID_CAT.has(x as ListingCategory))
}

export async function listSyncPartners(): Promise<SyncPartnerRow[] | null> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null
  const { data, error } = await supabase.from('rentadria_sync_partners').select('*').order('updated_at', { ascending: false })
  if (error || !Array.isArray(data)) return []
  const out: SyncPartnerRow[] = []
  for (const r of data) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : ''
    const name = typeof o.name === 'string' ? o.name : ''
    const baseUrl = typeof o.base_url === 'string' ? o.base_url : ''
    if (!id || !name || !baseUrl) continue
    out.push({
      id,
      name,
      baseUrl,
      apiKey: typeof o.api_key === 'string' ? o.api_key : undefined,
      categories: parseCats(o.categories),
      createdAt: typeof o.created_at === 'string' ? o.created_at : new Date().toISOString(),
      updatedAt: typeof o.updated_at === 'string' ? o.updated_at : new Date().toISOString(),
    })
  }
  return out
}

export async function upsertSyncPartner(input: {
  id: string
  name: string
  baseUrl: string
  apiKey?: string
  categories: Record<ListingCategory, boolean>
}): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return false
  const row = {
    id: input.id,
    name: input.name.trim(),
    base_url: input.baseUrl.trim().replace(/\/$/, ''),
    api_key: input.apiKey?.trim() || null,
    categories: input.categories,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('rentadria_sync_partners').upsert(row, { onConflict: 'id' })
  return !error
}

export async function deleteSyncPartner(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return false
  const { error } = await supabase.from('rentadria_sync_partners').delete().eq('id', id)
  return !error
}

export async function getImportOwnerSettings(ownerUserId: string): Promise<ImportOwnerSettingsRow | null> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null
  const uid = ownerUserId.trim().toLowerCase()
  if (!uid) return null
  const { data, error } = await supabase.from('rentadria_import_owner_settings').select('*').eq('owner_user_id', uid).maybeSingle()
  if (error) return null
  if (!data) {
    return { ownerUserId: uid, feedUrl: null, fieldMapping: {}, updatedAt: new Date().toISOString() }
  }
  const o = data as Record<string, unknown>
  const fm: Record<string, string> = {}
  if (o.field_mapping && typeof o.field_mapping === 'object' && !Array.isArray(o.field_mapping)) {
    for (const [k, v] of Object.entries(o.field_mapping as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) fm[k] = v.trim()
    }
  }
  return {
    ownerUserId: uid,
    feedUrl: typeof o.feed_url === 'string' && o.feed_url.trim() ? o.feed_url.trim() : null,
    fieldMapping: fm,
    updatedAt: typeof o.updated_at === 'string' ? o.updated_at : new Date().toISOString(),
  }
}

export async function upsertImportOwnerSettings(input: {
  ownerUserId: string
  feedUrl: string | null
  fieldMapping: Record<string, string>
}): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return false
  const uid = input.ownerUserId.trim().toLowerCase()
  if (!uid) return false
  const row = {
    owner_user_id: uid,
    feed_url: input.feedUrl?.trim() || null,
    field_mapping: input.fieldMapping,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('rentadria_import_owner_settings').upsert(row, { onConflict: 'owner_user_id' })
  return !error
}

export async function listSyncJobs(limit = 30): Promise<SyncJobRow[] | null> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null
  const { data, error } = await supabase.from('rentadria_sync_jobs').select('*').order('at', { ascending: false }).limit(limit)
  if (error || !Array.isArray(data)) return []
  const out: SyncJobRow[] = []
  for (const r of data) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : ''
    const at = typeof o.at === 'string' ? o.at : new Date().toISOString()
    const scope = o.scope === 'site' ? 'site' : 'owner'
    const status = o.status === 'error' ? 'error' : 'ok'
    const message = typeof o.message === 'string' ? o.message : ''
    if (!id || !message) continue
    out.push({
      id,
      at,
      scope,
      ownerUserId: typeof o.owner_user_id === 'string' ? o.owner_user_id : null,
      partnerId: typeof o.partner_id === 'string' ? o.partner_id : null,
      categories: parseCatArray(o.categories),
      status,
      message,
    })
  }
  return out
}

export async function insertSyncJob(input: {
  scope: 'owner' | 'site'
  ownerUserId?: string | null
  partnerId?: string | null
  categories: ListingCategory[]
  status: 'ok' | 'error'
  message: string
}): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return false
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? (crypto.randomUUID as () => string)()
      : `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const row = {
    id,
    scope: input.scope,
    status: input.status,
    message: input.message,
    owner_user_id: input.ownerUserId ?? null,
    partner_id: input.partnerId ?? null,
    categories: input.categories,
    at: new Date().toISOString(),
  }
  const { error } = await supabase.from('rentadria_sync_jobs').insert(row)
  return !error
}

