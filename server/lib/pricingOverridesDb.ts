import { getSupabaseAdmin } from './supabaseAdmin.js'

const TABLE = 'rentadria_pricing_overrides'

export async function getPricingOverride(locale: string): Promise<unknown[] | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const loc = locale.trim().toLowerCase()
  const { data, error } = await sb.from(TABLE).select('plans').eq('locale', loc).maybeSingle()
  if (error) return null
  if (!data || typeof data !== 'object') return []
  const plans = (data as { plans?: unknown }).plans
  return Array.isArray(plans) ? plans : []
}

export async function savePricingOverride(locale: string, plans: unknown[]): Promise<boolean> {
  const sb = getSupabaseAdmin()
  if (!sb) return false
  const loc = locale.trim().toLowerCase()
  const row = { locale: loc, plans, updated_at: new Date().toISOString() }
  const { error } = await sb.from(TABLE).upsert(row, { onConflict: 'locale' })
  return !error
}

export async function deletePricingOverride(locale: string): Promise<boolean> {
  const sb = getSupabaseAdmin()
  if (!sb) return false
  const loc = locale.trim().toLowerCase()
  const { error } = await sb.from(TABLE).delete().eq('locale', loc)
  return !error
}

