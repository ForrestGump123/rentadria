import type { SearchCountryId } from '../data/cities/countryIds'
import type { RegistrationCountryCode } from '../registrationCountries'

const KEY = 'rentadria_pending_registration_v1'

export type PendingRegistration = {
  email: string
  passwordHash: string
  phone: string
  countryId: SearchCountryId
  name: string
  /** Promotivni kod s forme za registraciju (opciono). */
  promoCode?: string
}

/** Map UI registration locale codes → search facet country ids. */
export function registrationCodeToCountryId(code: RegistrationCountryCode): SearchCountryId {
  const m: Record<RegistrationCountryCode, SearchCountryId> = {
    cnr: 'me',
    sr: 'rs',
    hr: 'hr',
    bs: 'ba',
    sq: 'al',
    it: 'it',
    es: 'es',
  }
  return m[code]
}

export function stashPendingRegistration(p: PendingRegistration): void {
  try {
    const raw = localStorage.getItem(KEY)
    const map = (raw ? (JSON.parse(raw) as Record<string, PendingRegistration>) : {}) ?? {}
    map[p.email.trim().toLowerCase()] = { ...p, email: p.email.trim().toLowerCase() }
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function clearPendingRegistrationForEmail(email: string): void {
  try {
    const em = email.trim().toLowerCase()
    const raw = localStorage.getItem(KEY)
    const map = (raw ? (JSON.parse(raw) as Record<string, PendingRegistration>) : {}) ?? {}
    if (!map[em]) return
    delete map[em]
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function takePendingRegistration(email: string): PendingRegistration | null {
  try {
    const em = email.trim().toLowerCase()
    const raw = localStorage.getItem(KEY)
    const map = (raw ? (JSON.parse(raw) as Record<string, PendingRegistration>) : {}) ?? {}
    const row = map[em]
    if (!row) return null
    delete map[em]
    localStorage.setItem(KEY, JSON.stringify(map))
    return row
  } catch {
    return null
  }
}
