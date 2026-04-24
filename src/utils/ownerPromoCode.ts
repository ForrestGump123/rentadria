import type { OwnerProfile } from './ownerSession'
import { saveOwnerProfile } from './ownerSession'

/** Normalizacija: trim, višestruki razmaci, velika slova (za konzistentan prikaz). */
export function normalizePromoCodeInput(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toUpperCase()
}

export function getSavedPromoCode(profile: OwnerProfile): { code: string } | null {
  const code = profile.promoCode
  if (!code || typeof code !== 'string') return null
  return { code }
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
  | 'admin_override'
  | 'backend_unavailable'

function mapRedeemReason(r: string): SavePromoFailReason | null {
  if (
    r === 'restricted' ||
    r === 'expired' ||
    r === 'max_uses' ||
    r === 'country' ||
    r === 'max_per_country' ||
    r === 'category' ||
    r === 'admin_override'
  ) {
    return r
  }
  if (r === 'owner_backend_unavailable') return 'backend_unavailable'
  return null
}

/** Server aktivacija: redeem + update owner profile (Supabase). */
async function applyPromoOnServer(code: string): Promise<{ ok: true } | { ok: false; reason: SavePromoFailReason }> {
  try {
    const r = await fetch('/api/owner-promo-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code }),
    })
    if (r.status === 503) return { ok: false, reason: 'backend_unavailable' }
    const j = (await r.json()) as {
      ok?: boolean
      reason?: string
    }
    if (!r.ok || !j.ok) {
      const mapped = j.reason ? mapRedeemReason(j.reason) : null
      return { ok: false, reason: mapped ?? 'unknown' }
    }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'backend_unavailable' }
  }
}

export async function savePromoCode(
  raw: string,
  profile: OwnerProfile,
): Promise<{ ok: true } | { ok: false; reason: SavePromoFailReason }> {
  const code = normalizePromoCodeInput(raw)
  if (!code) return { ok: false, reason: 'empty' }
  if (code.length > 64) return { ok: false, reason: 'too_long' }

  // Server is source of truth; apply there first.
  const applied = await applyPromoOnServer(code)
  if (!applied.ok) return applied

  // Optimistic local update until next profile pull (do NOT push, server is truth).
  saveOwnerProfile({ ...profile, promoCode: code })
  return { ok: true }
}

export function clearPromoCode(userId: string): void {
  void userId
}
