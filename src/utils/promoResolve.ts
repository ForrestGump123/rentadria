import type { AdminPromoCodeRecord } from './adminPromoCodes'
import { getAdminPromoByCode } from './adminPromoCodes'

/**
 * Lokalni admin storage, zatim (na Vercelu) `RENTADRIA_ADMIN_PROMO_JSON` na serveru.
 */
export async function resolvePromoRecord(normalized: string): Promise<AdminPromoCodeRecord | undefined> {
  const code = normalized.trim().toUpperCase().replace(/\s+/g, '')
  if (!code) return undefined
  const local = getAdminPromoByCode(code)
  if (local) return local
  try {
    const r = await fetch('/api/promo-resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    if (!r.ok) return undefined
    const j = (await r.json()) as { record?: AdminPromoCodeRecord }
    return j.record
  } catch {
    return undefined
  }
}
