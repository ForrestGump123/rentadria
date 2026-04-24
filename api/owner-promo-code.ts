import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { ownerUserIdFromCookie } from '../server/lib/ownerSessionAuth.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { getSupabaseAdmin } from '../server/lib/supabaseAdmin.js'
import { getRegisteredOwnerProfile } from '../server/lib/registeredOwnersDb.js'
import { parsePromoRecordJson, validatePromoRecordOnServer } from '../server/lib/promoServerValidate.js'

type Ok = { ok: true; profileUpdated: true }
type Fail = {
  ok: false
  reason:
    | 'empty'
    | 'too_long'
    | 'unknown'
    | 'restricted'
    | 'expired'
    | 'max_uses'
    | 'country'
    | 'max_per_country'
    | 'category'
    | 'admin_override'
    | 'owner_backend_unavailable'
    | 'bad_request'
}

function addMonthsIsoFrom(n: number, from: Date): string {
  const d = new Date(from)
  d.setMonth(d.getMonth() + n)
  return d.toISOString()
}

function addOneYearIsoFrom(from: Date): string {
  const d = new Date(from)
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString()
}

function endOfValidDayIso(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

function earlierIso(a: string, b: string): string {
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b
}

function normalizePromoCodeInput(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toUpperCase()
}

function mapReason(r: string): Fail['reason'] | null {
  if (
    r === 'restricted' ||
    r === 'expired' ||
    r === 'max_uses' ||
    r === 'country' ||
    r === 'max_per_country' ||
    r === 'category'
  ) {
    return r
  }
  return null
}

function computeUnlockedCategoriesFromOwnerRow(row: {
  subscriptionActive: boolean
  plan: string | null
  basicCategoryChoice?: string | null
  promoCategoryScope?: string[] | null
}): string[] {
  if (!row.subscriptionActive || !row.plan) return []
  let base: string[]
  if (row.plan === 'basic') {
    const c = row.basicCategoryChoice
    base = c === 'accommodation' || c === 'car' || c === 'motorcycle' ? [c] : []
  } else {
    base = ['accommodation', 'car', 'motorcycle']
  }
  const scope = row.promoCategoryScope
  if (scope && scope.length > 0) {
    const allow = new Set(scope)
    return base.filter((c) => allow.has(c))
  }
  return base
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, reason: 'bad_request' } satisfies Fail)
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`owner-promo-code:${ip}`, 60, 60_000)) {
    send429(res)
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const ownerUid = await ownerUserIdFromCookie(cookieHeader)
  if (!ownerUid) {
    res.status(401).json({ ok: false, reason: 'bad_request' } satisfies Fail)
    return
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    res.status(503).json({ ok: false, reason: 'owner_backend_unavailable' } satisfies Fail)
    return
  }

  const body = parseRequestJsonRecord(req)
  const codeRaw = typeof body.code === 'string' ? body.code : ''
  const code = normalizePromoCodeInput(codeRaw)
  if (!code) {
    res.status(400).json({ ok: false, reason: 'empty' } satisfies Fail)
    return
  }
  if (code.length > 64) {
    res.status(400).json({ ok: false, reason: 'too_long' } satisfies Fail)
    return
  }

  const owner = await getRegisteredOwnerProfile(ownerUid)
  if (!owner) {
    res.status(503).json({ ok: false, reason: 'owner_backend_unavailable' } satisfies Fail)
    return
  }

  // Respect explicit admin plan override: promo code cannot change plan.
  const { data: ownerRaw } = await supabase
    .from('rentadria_registered_owners')
    .select('admin_meta')
    .eq('user_id', ownerUid)
    .maybeSingle()
  const adminMeta =
    ownerRaw && typeof ownerRaw === 'object' && ownerRaw.admin_meta && typeof ownerRaw.admin_meta === 'object' && !Array.isArray(ownerRaw.admin_meta)
      ? (ownerRaw.admin_meta as Record<string, unknown>)
      : null
  if (adminMeta?.plan_override === true) {
    res.status(400).json({ ok: false, reason: 'admin_override' } satisfies Fail)
    return
  }

  const { data: row, error: selErr } = await supabase
    .from('rentadria_promo_codes')
    .select('id, record')
    .eq('code', code)
    .maybeSingle()

  if (selErr) {
    res.status(500).json({ ok: false, reason: 'bad_request' } satisfies Fail)
    return
  }
  if (!row || typeof row.record !== 'object' || row.record === null) {
    res.status(400).json({ ok: false, reason: 'unknown' } satisfies Fail)
    return
  }

  const promoId = row.id as string
  const parsed = parsePromoRecordJson(row.record)
  if (!parsed) {
    res.status(500).json({ ok: false, reason: 'bad_request' } satisfies Fail)
    return
  }

  const unlockedCategories = computeUnlockedCategoriesFromOwnerRow({
    subscriptionActive: owner.subscriptionActive,
    plan: owner.plan,
    basicCategoryChoice: owner.basicCategoryChoice ?? null,
    promoCategoryScope: owner.promoCategoryScope ?? null,
  })

  const v = validatePromoRecordOnServer(parsed, {
    userId: owner.userId,
    countryId: owner.countryId ?? undefined,
    subscriptionActive: owner.subscriptionActive,
    plan: owner.plan,
    unlockedCategories,
  })
  if (v.ok === false) {
    res.status(400).json({ ok: false, reason: mapReason(v.reason) ?? 'unknown' } satisfies Fail)
    return
  }

  // Idempotent: if already redeemed, just apply plan/profile update again.
  const { data: existing } = await supabase
    .from('rentadria_promo_redemptions')
    .select('user_id')
    .eq('promo_id', promoId)
    .eq('user_id', owner.userId)
    .maybeSingle()

  if (!existing) {
    const { error: insErr } = await supabase.from('rentadria_promo_redemptions').insert({
      promo_id: promoId,
      user_id: owner.userId,
    })
    if (insErr && insErr.code !== '23505') {
      res.status(500).json({ ok: false, reason: 'bad_request' } satisfies Fail)
      return
    }

    const nextUses = parsed.uses + 1
    const nextUsesByCountry = { ...parsed.usesByCountry }
    const c = owner.countryId ?? undefined
    if (c) {
      nextUsesByCountry[c] = (nextUsesByCountry[c] ?? 0) + 1
    }
    const nextRecord = { ...parsed, uses: nextUses, usesByCountry: nextUsesByCountry }

    const { error: upErr } = await supabase
      .from('rentadria_promo_codes')
      .update({ record: nextRecord as unknown as Record<string, unknown>, updated_at: new Date().toISOString() })
      .eq('id', promoId)

    if (upErr) {
      await supabase.from('rentadria_promo_redemptions').delete().eq('promo_id', promoId).eq('user_id', owner.userId)
      res.status(500).json({ ok: false, reason: 'bad_request' } satisfies Fail)
      return
    }
  }

  const now = new Date()
  const cap = parsed.validUntil ? endOfValidDayIso(parsed.validUntil) : null
  const promoCategoryScope = parsed.categories.length > 0 ? parsed.categories : null

  let nextValidUntil: string
  if (parsed.type === 'free_forever') nextValidUntil = '2099-12-31T23:59:59.999Z'
  else if (parsed.type === 'free_year') nextValidUntil = cap ? earlierIso(addOneYearIsoFrom(now), cap) : addOneYearIsoFrom(now)
  else if (parsed.type === 'free_month') nextValidUntil = cap ? earlierIso(addMonthsIsoFrom(1, now), cap) : addMonthsIsoFrom(1, now)
  else nextValidUntil = cap ? earlierIso(addOneYearIsoFrom(now), cap) : addOneYearIsoFrom(now)

  const { error: ownerUpErr } = await supabase
    .from('rentadria_registered_owners')
    .update({
      plan: 'pro',
      subscription_active: true,
      valid_until: nextValidUntil,
      basic_category_choice: null,
      promo_category_scope: promoCategoryScope,
      promo_code: code,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', ownerUid)

  if (ownerUpErr) {
    res.status(500).json({ ok: false, reason: 'bad_request' } satisfies Fail)
    return
  }

  res.status(200).json({ ok: true, profileUpdated: true } satisfies Ok)
}

