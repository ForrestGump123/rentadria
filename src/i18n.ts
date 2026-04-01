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
const ownerCnr = (cnr as { owner: Record<string, unknown> }).owner

/** Deep-merge owner namespace: CNR base + locale overrides (sr/hr/bs imaju parcijalan owner.listing). */
function mergeDeep(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }
  for (const k of Object.keys(patch)) {
    const pv = patch[k]
    const bv = base[k]
    if (
      pv &&
      typeof pv === 'object' &&
      !Array.isArray(pv) &&
      bv &&
      typeof bv === 'object' &&
      !Array.isArray(bv)
    ) {
      out[k] = mergeDeep(bv as Record<string, unknown>, pv as Record<string, unknown>)
    } else if (pv !== undefined) {
      out[k] = pv
    }
  }
  return out
}

function withOwnerMergedFromCnr<T extends Record<string, unknown>>(loc: T): T & { owner: unknown } {
  const localOwner = (loc.owner ?? {}) as Record<string, unknown>
  return {
    ...loc,
    owner: mergeDeep(ownerCnr, localOwner),
  } as T & { owner: unknown }
}

const storedLng =
  typeof localStorage !== 'undefined' ? localStorage.getItem('i18nextLng') : null

const supportedLngs = ['en', 'cnr', 'sr', 'hr', 'bs', 'sq', 'it', 'es'] as const

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    cnr: { translation: cnr },
    /** Južnoslavenski: admin s CNR-a; owner.listing potpun iz CNR + lokalni override. */
    sr: { translation: withAdminBlock(withOwnerMergedFromCnr(sr as Record<string, unknown>), adminCnr) },
    hr: { translation: withAdminBlock(withOwnerMergedFromCnr(hr as Record<string, unknown>), adminCnr) },
    bs: { translation: withAdminBlock(withOwnerMergedFromCnr(bs as Record<string, unknown>), adminCnr) },
    /** Ostali: engleski admin dok se ne doda pun prijevod u JSON. */
    sq: { translation: withAdminBlock(sq as Record<string, unknown>, adminEn) },
    it: { translation: withAdminBlock(it as Record<string, unknown>, adminEn) },
    es: { translation: withAdminBlock(es as Record<string, unknown>, adminEn) },
  },
  supportedLngs: [...supportedLngs],
  load: 'languageOnly',
  nonExplicitSupportedLngs: true,
  lng:
    storedLng && (supportedLngs as readonly string[]).includes(storedLng.split('-')[0] ?? '')
      ? storedLng.split('-')[0]!
      : 'en',
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
