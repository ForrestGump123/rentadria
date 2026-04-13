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
  const passwordHash =
    payload.passwordHash && /^[a-f0-9]{64}$/i.test(payload.passwordHash)
      ? payload.passwordHash.toLowerCase()
      : null
  const row = {
    user_id: userId,
    email: userId,
    display_name: payload.name.trim() || userId.split('@')[0] || userId,
    phone: payload.phone?.trim() || null,
    country_id: payload.countryId && ALLOWED.has(payload.countryId) ? payload.countryId : null,
    password_hash: passwordHash,
    registered_at: registeredAtIso,
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

export async function loginRegisteredOwner(
  email: string,
  passwordPlain: string,
): Promise<RegisteredOwnerApiRow | null> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null

  const em = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return null

  const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', em).maybeSingle()

  if (error || !data || typeof data !== 'object') return null
  const rec = data as Record<string, unknown>
  const stored = typeof rec.password_hash === 'string' ? rec.password_hash.trim().toLowerCase() : ''
  if (!/^[a-f0-9]{64}$/.test(stored)) return null

  const hash = createHash('sha256').update(passwordPlain, 'utf8').digest('hex')
  const a = Buffer.from(hash, 'utf8')
  const b = Buffer.from(stored, 'utf8')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  return rowToApi(rec)
}
