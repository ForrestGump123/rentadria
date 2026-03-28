import type { FaqItem, LegalSection } from './types'
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

function resolveLegalContentKey(language: string): LegalContentKey {
  const base = (language.split('-')[0] ?? 'en').toLowerCase()
  if (BALKAN_LOCALES.has(base)) return 'cnr'
  if (base === 'sq') return 'sq'
  if (base === 'it') return 'it'
  if (base === 'es') return 'es'
  return 'en'
}

export function getTermsSections(language: string): LegalSection[] {
  switch (resolveLegalContentKey(language)) {
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

export function getPrivacySections(language: string): LegalSection[] {
  switch (resolveLegalContentKey(language)) {
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

export function getFaqItems(language: string): FaqItem[] {
  switch (resolveLegalContentKey(language)) {
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
