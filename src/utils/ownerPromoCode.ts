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

export function savePromoCode(userId: string, raw: string): { ok: true } | { ok: false; reason: 'empty' | 'too_long' } {
  const code = normalizePromoCodeInput(raw)
  if (!code) return { ok: false, reason: 'empty' }
  if (code.length > 64) return { ok: false, reason: 'too_long' }
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
