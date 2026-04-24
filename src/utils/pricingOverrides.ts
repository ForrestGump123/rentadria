import type { PricingPlanDef } from '../content/pricingPlans'
export type PricingLocale = 'cnr' | 'en' | 'sq' | 'it' | 'es'

const JSON_HDR = { 'Content-Type': 'application/json' } as const

let cache: Partial<Record<PricingLocale, PricingPlanDef[]>> = {}

// Synchronous read used by `getPricingPlans()` (content layer). Cache is populated by `pullPricingOverride`.
export function loadPricingOverride(locale: PricingLocale): PricingPlanDef[] | null {
  return getCachedPricingOverride(locale)
}

export function getCachedPricingOverride(locale: PricingLocale): PricingPlanDef[] | null {
  const arr = cache[locale]
  return Array.isArray(arr) && arr.length > 0 ? arr : null
}

export async function pullPricingOverride(locale: PricingLocale): Promise<PricingPlanDef[] | null> {
  try {
    const q = new URLSearchParams({ locale })
    const r = await fetch(`/api/pricing-overrides?${q}`)
    const j = (await r.json()) as { ok?: boolean; plans?: unknown[] }
    if (!r.ok || !j.ok || !Array.isArray(j.plans)) return null
    const plans = j.plans as PricingPlanDef[]
    cache = { ...cache, [locale]: plans }
    try {
      window.dispatchEvent(new Event('rentadria-pricing-overrides-updated'))
    } catch {
      /* ignore */
    }
    return plans
  } catch {
    return null
  }
}

export async function savePricingOverride(locale: PricingLocale, plans: PricingPlanDef[]): Promise<boolean> {
  try {
    const r = await fetch('/api/admin-pricing-overrides', {
      method: 'POST',
      credentials: 'include',
      headers: JSON_HDR,
      body: JSON.stringify({ locale, plans }),
    })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean }
    if (!r.ok || j.ok !== true) return false
    cache = { ...cache, [locale]: plans }
    try {
      window.dispatchEvent(new Event('rentadria-pricing-overrides-updated'))
    } catch {
      /* ignore */
    }
    return true
  } catch {
    return false
  }
}

export async function resetPricingOverride(locale: PricingLocale): Promise<boolean> {
  try {
    const r = await fetch('/api/admin-pricing-overrides', {
      method: 'POST',
      credentials: 'include',
      headers: JSON_HDR,
      body: JSON.stringify({ locale, action: 'reset' }),
    })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean }
    if (!r.ok || j.ok !== true) return false
    cache = { ...cache, [locale]: [] }
    try {
      window.dispatchEvent(new Event('rentadria-pricing-overrides-updated'))
    } catch {
      /* ignore */
    }
    return true
  } catch {
    return false
  }
}
