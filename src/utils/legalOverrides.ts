import type { FaqItem, LegalSection } from '../content/legal/types'

export type LegalLocaleKey = 'cnr' | 'en' | 'sq' | 'it' | 'es'
export type LegalKind = 'terms' | 'privacy' | 'faq'

const JSON_HDR = { 'Content-Type': 'application/json' } as const

type Cache = Partial<
  Record<
    LegalLocaleKey,
    {
      terms?: LegalSection[]
      privacy?: LegalSection[]
      faq?: FaqItem[]
    }
  >
>

let cache: Cache = {}

function setCache(locale: LegalLocaleKey, kind: LegalKind, value: unknown[]): void {
  const prev = cache[locale] ?? {}
  cache = {
    ...cache,
    [locale]: {
      ...prev,
      [kind]: value,
    },
  }
  try {
    window.dispatchEvent(new Event('rentadria-legal-overrides-updated'))
  } catch {
    /* ignore */
  }
}

export function loadTermsOverride(localeKey: string): LegalSection[] | null {
  const loc = localeKey as LegalLocaleKey
  const v = cache[loc]?.terms
  return Array.isArray(v) && v.length > 0 ? v : null
}

export function loadPrivacyOverride(localeKey: string): LegalSection[] | null {
  const loc = localeKey as LegalLocaleKey
  const v = cache[loc]?.privacy
  return Array.isArray(v) && v.length > 0 ? v : null
}

export function loadFaqOverride(localeKey: string): FaqItem[] | null {
  const loc = localeKey as LegalLocaleKey
  const v = cache[loc]?.faq
  return Array.isArray(v) && v.length > 0 ? v : null
}

export async function pullLegalOverride(locale: LegalLocaleKey, kind: LegalKind): Promise<unknown[] | null> {
  try {
    const q = new URLSearchParams({ locale, kind })
    const r = await fetch(`/api/legal?${q}`)
    const j = (await r.json()) as { ok?: boolean; content?: unknown[] }
    if (!r.ok || !j.ok || !Array.isArray(j.content)) return null
    setCache(locale, kind, j.content)
    return j.content
  } catch {
    return null
  }
}

export async function saveLegalOverride(locale: LegalLocaleKey, kind: LegalKind, content: unknown[]): Promise<boolean> {
  try {
    const r = await fetch('/api/admin-legal', {
      method: 'POST',
      credentials: 'include',
      headers: JSON_HDR,
      body: JSON.stringify({ locale, kind, content }),
    })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean }
    if (!r.ok || j.ok !== true) return false
    setCache(locale, kind, content)
    return true
  } catch {
    return false
  }
}

export async function resetLegalOverride(locale: LegalLocaleKey, kind: LegalKind): Promise<boolean> {
  try {
    const r = await fetch('/api/admin-legal', {
      method: 'POST',
      credentials: 'include',
      headers: JSON_HDR,
      body: JSON.stringify({ locale, kind, action: 'reset' }),
    })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean }
    if (!r.ok || j.ok !== true) return false
    setCache(locale, kind, [])
    return true
  } catch {
    return false
  }
}
