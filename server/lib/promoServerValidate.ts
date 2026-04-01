/**
 * Validacija promo zapisa na serveru (isti smisao kao validatePromoRecordForOwner u klijentu).
 */

export type PromoRecordShape = {
  id: string
  code: string
  type: string
  discountPercent: number | null
  validUntil: string | null
  maxUses: number | null
  countries: string[]
  maxUsesPerCountry: number | null
  categories: string[]
  restrictedUserId: string | null
  note: string
  createdAt: string
  uses: number
  usesByCountry: Record<string, number>
}

export type PromoValidateFail =
  | 'restricted'
  | 'expired'
  | 'max_uses'
  | 'country'
  | 'max_per_country'
  | 'category'

export type PromoValidateCtx = {
  userId: string
  countryId?: string
  subscriptionActive?: boolean
  plan?: string | null
  unlockedCategories?: string[]
}

function hasActivePaidPlan(ctx: PromoValidateCtx): boolean {
  return ctx.subscriptionActive === true && ctx.plan != null && ctx.plan !== ''
}

export function validatePromoRecordOnServer(
  record: PromoRecordShape,
  ctx: PromoValidateCtx,
): { ok: true } | { ok: false; reason: PromoValidateFail } {
  if (record.restrictedUserId && record.restrictedUserId !== ctx.userId) {
    return { ok: false, reason: 'restricted' }
  }

  const now = Date.now()
  if (record.validUntil) {
    const end = new Date(record.validUntil)
    end.setHours(23, 59, 59, 999)
    if (now > end.getTime()) return { ok: false, reason: 'expired' }
  }

  if (record.maxUses != null && record.uses >= record.maxUses) {
    return { ok: false, reason: 'max_uses' }
  }

  const ownerCountry = ctx.countryId
  if (record.countries.length > 0) {
    if (!ownerCountry || !record.countries.includes(ownerCountry)) {
      return { ok: false, reason: 'country' }
    }
  }

  if (record.maxUsesPerCountry != null && ownerCountry) {
    const u = record.usesByCountry[ownerCountry] ?? 0
    if (u >= record.maxUsesPerCountry) return { ok: false, reason: 'max_per_country' }
  }

  if (record.categories.length > 0 && hasActivePaidPlan(ctx)) {
    const unlocked = ctx.unlockedCategories ?? []
    const okCat = record.categories.some((c) => unlocked.includes(c))
    if (!okCat) return { ok: false, reason: 'category' }
  }

  return { ok: true }
}

export function parsePromoRecordJson(raw: unknown): PromoRecordShape | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.code !== 'string' || typeof o.type !== 'string') return null
  if (typeof o.createdAt !== 'string') return null
  const uses = typeof o.uses === 'number' ? o.uses : 0
  const countries = Array.isArray(o.countries) ? o.countries.filter((x): x is string => typeof x === 'string') : []
  const categories = Array.isArray(o.categories)
    ? o.categories.filter((x): x is string => typeof x === 'string')
    : []
  const usesByCountry: Record<string, number> = {}
  if (o.usesByCountry && typeof o.usesByCountry === 'object' && !Array.isArray(o.usesByCountry)) {
    for (const [k, v] of Object.entries(o.usesByCountry as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) usesByCountry[k] = v
    }
  }
  return {
    id: o.id,
    code: o.code,
    type: o.type,
    discountPercent: typeof o.discountPercent === 'number' ? o.discountPercent : null,
    validUntil: typeof o.validUntil === 'string' ? o.validUntil : null,
    maxUses: (() => {
      if (o.maxUses === null || o.maxUses === undefined) return null
      const n = typeof o.maxUses === 'number' ? o.maxUses : Number(String(o.maxUses))
      return Number.isFinite(n) ? n : null
    })(),
    countries,
    maxUsesPerCountry: (() => {
      if (o.maxUsesPerCountry === null || o.maxUsesPerCountry === undefined) return null
      const n =
        typeof o.maxUsesPerCountry === 'number' ? o.maxUsesPerCountry : Number(String(o.maxUsesPerCountry))
      return Number.isFinite(n) ? n : null
    })(),
    categories,
    restrictedUserId: typeof o.restrictedUserId === 'string' ? o.restrictedUserId : null,
    note: typeof o.note === 'string' ? o.note : '',
    createdAt: o.createdAt,
    uses,
    usesByCountry,
  }
}
