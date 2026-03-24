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

const storedLng =
  typeof localStorage !== 'undefined' ? localStorage.getItem('i18nextLng') : null

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    cnr: { translation: cnr },
    sr: { translation: sr },
    hr: { translation: hr },
    bs: { translation: bs },
    sq: { translation: sq },
    it: { translation: it },
    es: { translation: es },
  },
  lng: storedLng && ['en', 'cnr', 'sr', 'hr', 'bs', 'sq', 'it', 'es'].includes(storedLng) ? storedLng : 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('i18nextLng', lng)
})

export default i18n
