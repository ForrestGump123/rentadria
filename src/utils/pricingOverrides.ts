import type { PricingPlanDef } from '../content/pricingPlans'

const KEY = 'rentadria_pricing_plans_override_v1'

type Blob = Partial<Record<'cnr' | 'en' | 'sq' | 'it' | 'es', PricingPlanDef[]>>

function loadBlob(): Blob {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as unknown
    return o && typeof o === 'object' ? (o as Blob) : {}
  } catch {
    return {}
  }
}

export function loadPricingOverride(locale: 'cnr' | 'en' | 'sq' | 'it' | 'es'): PricingPlanDef[] | null {
  const arr = loadBlob()[locale]
  return arr && arr.length > 0 ? arr : null
}

export function savePricingOverride(locale: 'cnr' | 'en' | 'sq' | 'it' | 'es', plans: PricingPlanDef[]): void {
  const b = loadBlob()
  b[locale] = plans
  localStorage.setItem(KEY, JSON.stringify(b))
  try {
    window.dispatchEvent(new Event('rentadria-pricing-overrides-updated'))
  } catch {
    /* ignore */
  }
}
