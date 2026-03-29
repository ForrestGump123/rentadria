import type { FaqItem, LegalSection } from './types'
import { loadFaqOverride, loadPrivacyOverride, loadTermsOverride } from '../../utils/legalOverrides'
import { FAQ_ITEMS_CNR } from './faq.cnr'
import { FAQ_ITEMS_EN } from './faq.en'
import { FAQ_ITEMS_ES } from './faq.es'
import { FAQ_ITEMS_IT } from './faq.it'
import { FAQ_ITEMS_SQ } from './faq.sq'
import { PRIVACY_SECTIONS_CNR } from './privacy.cnr'
import { PRIVACY_SECTIONS_EN } from './privacy.en'
import { PRIVACY_SECTIONS_ES } from './privacy.es'
import { PRIVACY_SECTIONS_IT } from './privacy.it'
import { PRIVACY_SECTIONS_SQ } from './privacy.sq'
import { TERMS_SECTIONS_CNR } from './terms.cnr'
import { TERMS_SECTIONS_EN } from './terms.en'
import { TERMS_SECTIONS_ES } from './terms.es'
import { TERMS_SECTIONS_IT } from './terms.it'
import { TERMS_SECTIONS_SQ } from './terms.sq'

const BALKAN_LOCALES = new Set(['cnr', 'sr', 'hr', 'bs'])

type LegalContentKey = 'cnr' | 'en' | 'sq' | 'it' | 'es'

export function resolveLegalContentKey(language: string): LegalContentKey {
  const base = (language.split('-')[0] ?? 'en').toLowerCase()
  if (BALKAN_LOCALES.has(base)) return 'cnr'
  if (base === 'sq') return 'sq'
  if (base === 'it') return 'it'
  if (base === 'es') return 'es'
  return 'en'
}

export function getBuiltInTerms(k: LegalContentKey): LegalSection[] {
  switch (k) {
    case 'cnr':
      return TERMS_SECTIONS_CNR
    case 'sq':
      return TERMS_SECTIONS_SQ
    case 'it':
      return TERMS_SECTIONS_IT
    case 'es':
      return TERMS_SECTIONS_ES
    default:
      return TERMS_SECTIONS_EN
  }
}

export function getBuiltInPrivacy(k: LegalContentKey): LegalSection[] {
  switch (k) {
    case 'cnr':
      return PRIVACY_SECTIONS_CNR
    case 'sq':
      return PRIVACY_SECTIONS_SQ
    case 'it':
      return PRIVACY_SECTIONS_IT
    case 'es':
      return PRIVACY_SECTIONS_ES
    default:
      return PRIVACY_SECTIONS_EN
  }
}

export function getBuiltInFaq(k: LegalContentKey): FaqItem[] {
  switch (k) {
    case 'cnr':
      return FAQ_ITEMS_CNR
    case 'sq':
      return FAQ_ITEMS_SQ
    case 'it':
      return FAQ_ITEMS_IT
    case 'es':
      return FAQ_ITEMS_ES
    default:
      return FAQ_ITEMS_EN
  }
}

export function getTermsSections(language: string): LegalSection[] {
  const k = resolveLegalContentKey(language)
  const o = loadTermsOverride(k)
  if (o && o.length > 0) return o
  return getBuiltInTerms(k)
}

export function getPrivacySections(language: string): LegalSection[] {
  const k = resolveLegalContentKey(language)
  const o = loadPrivacyOverride(k)
  if (o && o.length > 0) return o
  return getBuiltInPrivacy(k)
}

export function getFaqItems(language: string): FaqItem[] {
  const k = resolveLegalContentKey(language)
  const o = loadFaqOverride(k)
  if (o && o.length > 0) return o
  return getBuiltInFaq(k)
}
