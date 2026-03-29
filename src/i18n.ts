import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import cnr from './locales/cnr.json'
import sr from './locales/sr.json'
import hr from './locales/hr.json'
import bs from './locales/bs.json'
import sq from './locales/sq.json'
import it from './locales/it.json'
import es from './locales/es.json'

/** Jezici koji u JSON-u nemaju cijeli `admin` namespace dobijaju ga ovdje (inace i18next pada na engleski). */
function withAdminBlock<T extends Record<string, unknown>>(
  loc: T,
  adminSource: unknown,
): T & { admin: unknown } {
  if (loc.admin !== undefined && loc.admin !== null) return loc as T & { admin: unknown }
  return { ...loc, admin: adminSource } as T & { admin: unknown }
}

const adminCnr = (cnr as { admin: unknown }).admin
const adminEn = (en as { admin: unknown }).admin

const storedLng =
  typeof localStorage !== 'undefined' ? localStorage.getItem('i18nextLng') : null

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    cnr: { translation: cnr },
    /** Južnoslavenski: cijeli admin panel (crnogorski tekst) dok se ne prevede posebno. */
    sr: { translation: withAdminBlock(sr as Record<string, unknown>, adminCnr) },
    hr: { translation: withAdminBlock(hr as Record<string, unknown>, adminCnr) },
    bs: { translation: withAdminBlock(bs as Record<string, unknown>, adminCnr) },
    /** Ostali: engleski admin dok se ne doda pun prijevod u JSON. */
    sq: { translation: withAdminBlock(sq as Record<string, unknown>, adminEn) },
    it: { translation: withAdminBlock(it as Record<string, unknown>, adminEn) },
    es: { translation: withAdminBlock(es as Record<string, unknown>, adminEn) },
  },
  lng: storedLng && ['en', 'cnr', 'sr', 'hr', 'bs', 'sq', 'it', 'es'].includes(storedLng) ? storedLng : 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('i18nextLng', lng)
  if (typeof document !== 'undefined') document.documentElement.lang = lng.split('-')[0]
})

if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language.split('-')[0]
}

export default i18n
