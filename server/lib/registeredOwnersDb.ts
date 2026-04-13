import { createHash, timingSafeEqual } from 'node:crypto'
import { getSupabaseAdmin } from './supabaseAdmin.js'
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
  plan: null
  subscriptionActive: boolean
}

function rowToApi(r: Record<string, unknown>): RegisteredOwnerApiRow | null {
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
  return {
    userId,
    email: userId,
    displayName,
    phone,
    countryId,
    passwordHash: ph,
    registeredAt,
    validUntil: '',
    plan: null,
    subscriptionActive: false,
  }
}

/** Nakon uspješne verifikacije tokena — server kao izvor istine za admin / prijavu. */
export async function upsertRegisteredOwnerFromVerify(
  payload: VerifyTokenPayload,
  registeredAtIso: string,
): Promise<void> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return

  const userId = payload.email.toLowerCase()
  const passwordHashFromJwt =
    payload.passwordHash && /^[a-f0-9]{64}$/i.test(payload.passwordHash)
      ? payload.passwordHash.toLowerCase()
      : null

  const { data: existing } = await supabase
    .from(TABLE)
    .select('password_hash,registered_at,phone,country_id')
    .eq('user_id', userId)
    .maybeSingle()

  const ex = existing as Record<string, unknown> | null
  const existingHash =
    typeof ex?.password_hash === 'string' && /^[a-f0-9]{64}$/i.test(ex.password_hash)
      ? ex.password_hash.trim().toLowerCase()
      : null

  /** Ne prepisuj postojeći hash sa null (stari JWT bez lozinke). */
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

  const row = {
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
  }

  const { error } = await supabase.from(TABLE).upsert(row, { onConflict: 'user_id' })
  if (error) {
    if (process.env.VERCEL === '1' || process.env.NODE_ENV !== 'production') {
      console.warn('[rentadria] upsert registered owner:', error.message)
    }
  }
}

export async function listRegisteredOwnersForAdmin(): Promise<RegisteredOwnerApiRow[]> {
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

  const out: RegisteredOwnerApiRow[] = []
  if (!Array.isArray(data)) return out
  for (const raw of data) {
    const m = rowToApi(raw as Record<string, unknown>)
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
