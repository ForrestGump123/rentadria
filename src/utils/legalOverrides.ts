import type { FaqItem, LegalSection } from '../content/legal/types'

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function lsGet(key: string): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function loadTermsOverride(localeKey: string): LegalSection[] | null {
  const a = safeParse<unknown>(lsGet(`rentadria_legal_terms_${localeKey}`))
  return Array.isArray(a) ? (a as LegalSection[]) : null
}

export function saveTermsOverride(localeKey: string, sections: LegalSection[]): void {
  localStorage.setItem(`rentadria_legal_terms_${localeKey}`, JSON.stringify(sections))
}

export function loadPrivacyOverride(localeKey: string): LegalSection[] | null {
  const a = safeParse<unknown>(lsGet(`rentadria_legal_privacy_${localeKey}`))
  return Array.isArray(a) ? (a as LegalSection[]) : null
}

export function savePrivacyOverride(localeKey: string, sections: LegalSection[]): void {
  localStorage.setItem(`rentadria_legal_privacy_${localeKey}`, JSON.stringify(sections))
}

export function loadFaqOverride(localeKey: string): FaqItem[] | null {
  const a = safeParse<unknown>(lsGet(`rentadria_legal_faq_${localeKey}`))
  return Array.isArray(a) ? (a as FaqItem[]) : null
}

export function saveFaqOverride(localeKey: string, items: FaqItem[]): void {
  localStorage.setItem(`rentadria_legal_faq_${localeKey}`, JSON.stringify(items))
}
