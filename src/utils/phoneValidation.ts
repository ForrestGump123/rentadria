/** International numbers for ex-YU / Balkans (+38x) used at registration */
const REGISTER_PHONE = /^\+38[0-9]{8,14}$/

export function normalizePhoneInput(s: string): string {
  return s.replace(/\s/g, '')
}

export function isValidRegisterPhone(s: string): boolean {
  return REGISTER_PHONE.test(normalizePhoneInput(s))
}
