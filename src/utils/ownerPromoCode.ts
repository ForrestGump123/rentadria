import type { OwnerProfile } from './ownerSession'
import {
  applyPromoSubscriptionToProfile,
  getAdminPromoByCode,
  incrementPromoUses,
  validatePromoRecordForOwner,
} from './adminPromoCodes'
import { resolvePromoRecord } from './promoResolve'
import { getEffectiveUnlockedCategories, queueCloudOwnerProfilePush, saveOwnerProfile } from './ownerSession'

const STORAGE_KEY = 'rentadria_owner_promo_code_v1'

export type SavedPromoCode = {
  code: string
  savedAt: string
}

type Store = Record<string, SavedPromoCode>

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as unknown
    return o && typeof o === 'object' ? (o as Store) : {}
  } catch {
    return {}
  }
}

function save(m: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(m))
  try {
    window.dispatchEvent(new Event('rentadria-owner-promo-code-updated'))
  } catch {
    /* ignore */
  }
}

/** Normalizacija: trim, višestruki razmaci, velika slova (za konzistentan prikaz). */
export function normalizePromoCodeInput(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toUpperCase()
}

export function getSavedPromoCode(userId: string): SavedPromoCode | null {
  const m = load()
  const row = m[userId]
  if (!row || typeof row.code !== 'string' || typeof row.savedAt !== 'string') return null
  return row
}

export type SavePromoFailReason =
  | 'empty'
  | 'too_long'
  | 'unknown'
  | 'restricted'
  | 'expired'
  | 'max_uses'
  | 'country'
  | 'max_per_country'
  | 'category'

function mapRedeemReason(r: string): SavePromoFailReason | null {
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

/** Na Vercelu + Supabase: povećanje uses i red u rentadria_promo_redemptions. */
async function redeemPromoOnServer(
  code: string,
  profile: OwnerProfile,
): Promise<{ ok: true } | { ok: false; reason: SavePromoFailReason }> {
  const unlocked = getEffectiveUnlockedCategories(profile)
  try {
    const r = await fetch('/api/promo-redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        userId: profile.userId,
        countryId: profile.countryId,
        subscriptionActive: profile.subscriptionActive,
        plan: profile.plan,
        unlockedCategories: unlocked,
      }),
    })
    if (r.status === 503) {
      return { ok: true }
    }
    const j = (await r.json()) as {
      ok?: boolean
      skipped?: boolean
      reason?: string
    }
    if (j.skipped && j.ok) {
      return { ok: true }
    }
    if (!r.ok || !j.ok) {
      const mapped = j.reason ? mapRedeemReason(j.reason) : null
      return { ok: false, reason: mapped ?? 'unknown' }
    }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'unknown' }
  }
}

export async function savePromoCode(
  userId: string,
  raw: string,
  profile: OwnerProfile,
): Promise<{ ok: true } | { ok: false; reason: SavePromoFailReason }> {
  const code = normalizePromoCodeInput(raw)
  if (!code) return { ok: false, reason: 'empty' }
  if (code.length > 64) return { ok: false, reason: 'too_long' }

  const prev = getSavedPromoCode(userId)
  const isNewCode = prev?.code !== code

  const record = await resolvePromoRecord(code)
  if (!record) return { ok: false, reason: 'unknown' }

  if (isNewCode) {
    const v = validatePromoRecordForOwner(record, profile)
    if (!v.ok) return { ok: false, reason: v.reason }
    if (getAdminPromoByCode(code)) {
      incrementPromoUses(record.id, profile.countryId)
    } else {
      const redeem = await redeemPromoOnServer(code, profile)
      if (!redeem.ok) return redeem
    }
    const upgraded = applyPromoSubscriptionToProfile(profile, record)
    saveOwnerProfile(upgraded)
    queueCloudOwnerProfilePush(upgraded)
  }

  const m = load()
  m[userId] = { code, savedAt: new Date().toISOString() }
  save(m)
  return { ok: true }
}

export function clearPromoCode(userId: string): void {
  const m = load()
  delete m[userId]
  save(m)
}
