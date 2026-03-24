export const LANGUAGES = [
  { code: 'en', short: 'EN', flag: '🇬🇧', name: 'English' },
  { code: 'cnr', short: 'CG', flag: '🇲🇪', name: 'Crnogorski' },
  { code: 'sr', short: 'SR', flag: '🇷🇸', name: 'Srpski' },
  { code: 'hr', short: 'HR', flag: '🇭🇷', name: 'Hrvatski' },
  { code: 'bs', short: 'BS', flag: '🇧🇦', name: 'Bosanski' },
  { code: 'sq', short: 'SQ', flag: '🇦🇱', name: 'Shqip' },
  { code: 'it', short: 'IT', flag: '🇮🇹', name: 'Italiano' },
  { code: 'es', short: 'ES', flag: '🇪🇸', name: 'Español' },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']
