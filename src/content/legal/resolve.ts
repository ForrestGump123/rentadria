import type { FaqItem, LegalSection } from './types'
import { FAQ_ITEMS_CNR } from './faq.cnr'
import { FAQ_ITEMS_EN } from './faq.en'
import { PRIVACY_SECTIONS_CNR } from './privacy.cnr'
import { PRIVACY_SECTIONS_EN } from './privacy.en'
import { TERMS_SECTIONS_CNR } from './terms.cnr'
import { TERMS_SECTIONS_EN } from './terms.en'

/** Cn/Ijekavian content for `cnr`; all other locales use English until translated. */
export function getTermsSections(language: string): LegalSection[] {
  return language === 'cnr' ? TERMS_SECTIONS_CNR : TERMS_SECTIONS_EN
}

export function getPrivacySections(language: string): LegalSection[] {
  return language === 'cnr' ? PRIVACY_SECTIONS_CNR : PRIVACY_SECTIONS_EN
}

export function getFaqItems(language: string): FaqItem[] {
  return language === 'cnr' ? FAQ_ITEMS_CNR : FAQ_ITEMS_EN
}
