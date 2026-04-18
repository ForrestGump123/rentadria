import { createHash, timingSafeEqual } from 'node:crypto'
import { getSupabaseAdmin } from './supabaseAdmin.js'
import { addOneYearIsoFrom, registrationGetsFreePro } from './registrationPromo.js'
import type { VerifyTokenPayload } from './verifyJwt.js'

const TABLE = 'rentadria_registered_owners'

const ALLOWED = new Set(['al', 'ba', 'me', 'hr', 'it', 'rs', 'es'])

export type RegisteredOwnerApiRow = {
  userId: string
  email: string
  displayName: string
  phone?: string
  countryId?: string
  passwordHash?: string
  registeredAt: string
  validUntil: string
  plan: 'basic' | 'pro' | 'agency' | null
  subscriptionActive: boolean
  basicCategoryChoice?: 'accommodation' | 'car' | 'motorcycle' | null
}

export type RegisteredOwnerListItem = RegisteredOwnerApiRow & {
  adminMeta?: Record<string, unknown>
}

function parseValidUntil(r: Record<string, unknown>): string {
  const vu = r.valid_until
  if (vu == null || vu === '') return ''
  if (typeof vu === 'string') return vu
  try {
    return new Date(vu as string | number).toISOString()
  } catch {
    return ''
  }
}

function parsePlan(r: Record<string, unknown>): 'basic' | 'pro' | 'agency' | null {
  const p = typeof r.plan === 'string' ? r.plan.trim().toLowerCase() : ''
  if (p === 'basic' || p === 'pro' || p === 'agency') return p
  return null
}

function parseBasicCat(
  r: Record<string, unknown>,
): 'accommodation' | 'car' | 'motorcycle' | null | undefined {
  const c = typeof r.basic_category_choice === 'string' ? r.basic_category_choice.trim().toLowerCase() : ''
  if (c === 'accommodation' || c === 'car' || c === 'motorcycle') return c
  if (c === '') return undefined
  return null
}

export function rowToApi(r: Record<string, unknown>): RegisteredOwnerApiRow | null {
  const userId = typeof r.user_id === 'string' ? r.user_id.trim().toLowerCase() : ''
  if (!userId) return null
  const displayName =
    typeof r.display_name === 'string' && r.display_name.trim()
      ? r.display_name.trim()
      : userId.split('@')[0] || userId
  const phone = typeof r.phone === 'string' && r.phone.trim() ? r.phone.trim() : undefined
  const cid = typeof r.country_id === 'string' ? r.country_id.trim().toLowerCase() : ''
  const countryId = ALLOWED.has(cid) ? cid : undefined
  const ph = typeof r.password_hash === 'string' && /^[a-f0-9]{64}$/i.test(r.password_hash)
    ? r.password_hash.trim().toLowerCase()
    : undefined
  const registeredAt =
    typeof r.registered_at === 'string' && r.registered_at.trim()
      ? r.registered_at.trim()
      : new Date().toISOString()
  const plan = parsePlan(r)
  const subscriptionActive = Boolean(r.subscription_active)
  const validUntil = parseValidUntil(r)
  const bc = parseBasicCat(r)
  return {
    userId,
    email: userId,
    displayName,
    phone,
    countryId,
    passwordHash: ph,
    registeredAt,
    validUntil,
    plan,
    subscriptionActive,
    basicCategoryChoice: bc,
  }
}

function rowToListItem(r: Record<string, unknown>): RegisteredOwnerListItem | null {
  const base = rowToApi(r)
  if (!base) return null
  const am = r.admin_meta
  if (am && typeof am === 'object' && !Array.isArray(am)) {
    return { ...base, adminMeta: am as Record<string, unknown> }
  }
  return { ...base }
}

/** Nakon uspješne verifikacije tokena — server kao izvor istine za admin / prijavu. */
export async function upsertRegisteredOwnerFromVerify(
  payload: VerifyTokenPayload,
  registeredAtIso: string,
): Promise<RegisteredOwnerApiRow | null> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null

  const userId = payload.email.toLowerCase()
  const passwordHashFromJwt =
    payload.passwordHash && /^[a-f0-9]{64}$/i.test(payload.passwordHash)
      ? payload.passwordHash.toLowerCase()
      : null

  const { data: existing } = await supabase.from(TABLE).select('*').eq('user_id', userId).maybeSingle()

  const ex = existing as Record<string, unknown> | null
  const existingHash =
    typeof ex?.password_hash === 'string' && /^[a-f0-9]{64}$/i.test(ex.password_hash)
      ? ex.password_hash.trim().toLowerCase()
      : null

  const mergedPassword = passwordHashFromJwt ?? existingHash ?? null

  const phonePayload = payload.phone?.trim() || null
  const countryPayload =
    payload.countryId && ALLOWED.has(payload.countryId) ? payload.countryId : null
  const mergedPhone = phonePayload ?? (typeof ex?.phone === 'string' && ex.phone.trim() ? ex.phone.trim() : null)
  const exCid = typeof ex?.country_id === 'string' ? ex.country_id.trim().toLowerCase() : ''
  const mergedCountry =
    countryPayload ?? (ALLOWED.has(exCid) ? exCid : null)

  const registeredAt =
    typeof ex?.registered_at === 'string' && ex.registered_at.trim()
      ? String(ex.registered_at).trim()
      : registeredAtIso

  const isNew = !ex
  const hadStoredPlan = parsePlan(ex ?? {}) != null || Boolean(ex?.subscription_active)

  let plan: string | null = null
  let subscriptionActive = false
  let validUntil: string | null = null

  if (isNew) {
    const regDate = new Date(registeredAt)
    if (registrationGetsFreePro(regDate)) {
      plan = 'pro'
      subscriptionActive = true
      validUntil = addOneYearIsoFrom(regDate)
    } else {
      plan = null
      subscriptionActive = false
      validUntil = null
    }
  } else if (!hadStoredPlan) {
    const regDate = new Date(registeredAt)
    if (registrationGetsFreePro(regDate)) {
      plan = 'pro'
      subscriptionActive = true
      validUntil = addOneYearIsoFrom(regDate)
    } else {
      plan = null
      subscriptionActive = false
      validUntil = null
    }
  } else {
    plan = parsePlan(ex ?? {})
    subscriptionActive = Boolean(ex?.subscription_active)
    const vu = parseValidUntil(ex ?? {})
    validUntil = vu || null
  }

  const row: Record<string, unknown> = {
    user_id: userId,
    email: userId,
    display_name: payload.name.trim() || userId.split('@')[0] || userId,
    phone: mergedPhone,
    country_id: mergedCountry,
    password_hash: mergedPassword,
    registered_at: registeredAt,
    plan_pending: payload.plan,
    promo_code: payload.promoCode?.trim() || null,
    updated_at: new Date().toISOString(),
    plan,
    subscription_active: subscriptionActive,
    valid_until: validUntil,
  }

  if (ex?.admin_meta != null) {
    row.admin_meta = ex.admin_meta
  }

  const { error } = await supabase.from(TABLE).upsert(row, { onConflict: 'user_id' })
  if (error) {
    if (process.env.VERCEL === '1' || process.env.NODE_ENV !== 'production') {
      console.warn('[rentadria] upsert registered owner:', error.message)
    }
    return null
  }

  const { data: after } = await supabase.from(TABLE).select('*').eq('user_id', userId).maybeSingle()
  if (!after || typeof after !== 'object') return null
  return rowToApi(after as Record<string, unknown>)
}

export type AdminOwnerUpdateInput = {
  userId: string
  displayName: string
  email: string
  phone: string | null
  countryId: string | null
  passwordHash: string | null
  plan: 'basic' | 'pro' | 'agency' | null
  subscriptionActive: boolean
  validUntil: string | null
  basicCategoryChoice: 'accommodation' | 'car' | 'motorcycle' | null
  adminMeta: Record<string, unknown>
}

export async function updateRegisteredOwnerByAdmin(input: AdminOwnerUpdateInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return { ok: false, error: 'no_backend' }

  const uid = input.userId.trim().toLowerCase()
  if (!uid) return { ok: false, error: 'invalid_user' }

  const { data: existing } = await supabase.from(TABLE).select('*').eq('user_id', uid).maybeSingle()
  const ex = existing as Record<string, unknown> | null

  const passwordHashMerged =
    input.passwordHash && /^[a-f0-9]{64}$/i.test(input.passwordHash)
      ? input.passwordHash.toLowerCase()
      : typeof ex?.password_hash === 'string' && /^[a-f0-9]{64}$/i.test(ex.password_hash)
        ? ex.password_hash.trim().toLowerCase()
        : null

  const row: Record<string, unknown> = {
    user_id: uid,
    email: input.email.trim().toLowerCase(),
    display_name: input.displayName.trim() || uid.split('@')[0] || uid,
    phone: input.phone?.trim() || null,
    country_id: input.countryId && ALLOWED.has(input.countryId) ? input.countryId : null,
    password_hash: passwordHashMerged,
    plan: input.plan,
    subscription_active: input.subscriptionActive,
    valid_until: input.validUntil?.trim() || null,
    basic_category_choice: input.basicCategoryChoice,
    admin_meta: input.adminMeta,
    updated_at: new Date().toISOString(),
  }

  if (ex?.registered_at) row.registered_at = ex.registered_at
  else row.registered_at = new Date().toISOString()
  if (ex?.plan_pending != null) row.plan_pending = ex.plan_pending
  if (ex?.promo_code != null) row.promo_code = ex.promo_code

  const { error } = await supabase.from(TABLE).upsert(row, { onConflict: 'user_id' })
  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export async function listRegisteredOwnersForAdmin(): Promise<RegisteredOwnerListItem[]> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return []

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('registered_at', { ascending: false })

  if (error) {
    if (process.env.VERCEL === '1' || process.env.NODE_ENV !== 'production') {
      console.warn('[rentadria] list registered owners:', error.message)
    }
    return []
  }

  const out: RegisteredOwnerListItem[] = []
  if (!Array.isArray(data)) return out
  for (const raw of data) {
    const m = rowToListItem(raw as Record<string, unknown>)
    if (m) out.push(m)
  }
  return out
}

export type OwnerLoginResult =
  | { ok: true; profile: RegisteredOwnerApiRow }
  | { ok: false; reason: 'no_backend' | 'not_found' | 'bad_password' | 'no_password' }

export async function loginRegisteredOwner(email: string, passwordPlain: string): Promise<OwnerLoginResult> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return { ok: false, reason: 'no_backend' }

  const em = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return { ok: false, reason: 'not_found' }

  const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', em).maybeSingle()

  if (error || !data || typeof data !== 'object') return { ok: false, reason: 'not_found' }
  const rec = data as Record<string, unknown>
  const stored = typeof rec.password_hash === 'string' ? rec.password_hash.trim().toLowerCase() : ''
  if (!/^[a-f0-9]{64}$/.test(stored)) return { ok: false, reason: 'no_password' }

  const hash = createHash('sha256').update(passwordPlain, 'utf8').digest('hex')
  const a = Buffer.from(hash, 'utf8')
  const b = Buffer.from(stored, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'bad_password' }

  const profile = rowToApi(rec)
  if (!profile) return { ok: false, reason: 'not_found' }
  return { ok: true, profile }
}
