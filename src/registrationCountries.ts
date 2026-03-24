/** Registration country list: no English; codes align with site locales (minus `en`). */
export const REGISTRATION_COUNTRIES = [
  { code: 'cnr', flag: '🇲🇪' },
  { code: 'sr', flag: '🇷🇸' },
  { code: 'hr', flag: '🇭🇷' },
  { code: 'bs', flag: '🇧🇦' },
  { code: 'sq', flag: '🇦🇱' },
  { code: 'it', flag: '🇮🇹' },
  { code: 'es', flag: '🇪🇸' },
] as const

export type RegistrationCountryCode = (typeof REGISTRATION_COUNTRIES)[number]['code']

export function isRegistrationCountry(code: string): code is RegistrationCountryCode {
  return REGISTRATION_COUNTRIES.some((c) => c.code === code)
}
