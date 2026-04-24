import { getSupabaseAdmin } from './supabaseAdmin.js'

const TABLE = 'rentadria_legal_overrides'

export type LegalOverrideKind = 'terms' | 'privacy' | 'faq'

const KINDS = new Set<LegalOverrideKind>(['terms', 'privacy', 'faq'])
const LOCALES = new Set(['cnr', 'en', 'sq', 'it', 'es'])

export function legalKindOk(v: unknown): v is LegalOverrideKind {
  return typeof v === 'string' && KINDS.has(v as LegalOverrideKind)
}

export function legalLocaleOk(v: unknown): boolean {
  return typeof v === 'string' && LOCALES.has(v.trim().toLowerCase())
}

export async function getLegalOverride(kind: LegalOverrideKind, locale: string): Promise<unknown[] | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const loc = locale.trim().toLowerCase()
  const { data, error } = await sb.from(TABLE).select('content').eq('kind', kind).eq('locale', loc).maybeSingle()
  if (error) return null
  if (!data || typeof data !== 'object') return []
  const content = (data as { content?: unknown }).content
  return Array.isArray(content) ? content : []
}

export async function saveLegalOverride(kind: LegalOverrideKind, locale: string, content: unknown[]): Promise<boolean> {
  const sb = getSupabaseAdmin()
  if (!sb) return false
  const loc = locale.trim().toLowerCase()
  const row = { kind, locale: loc, content, updated_at: new Date().toISOString() }
  const { error } = await sb.from(TABLE).upsert(row, { onConflict: 'kind,locale' })
  return !error
}

export async function deleteLegalOverride(kind: LegalOverrideKind, locale: string): Promise<boolean> {
  const sb = getSupabaseAdmin()
  if (!sb) return false
  const loc = locale.trim().toLowerCase()
  const { error } = await sb.from(TABLE).delete().eq('kind', kind).eq('locale', loc)
  return !error
}

