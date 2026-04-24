/**
 * Isti kraj promotivnog perioda kao na serveru (`server/lib/registrationPromo.ts`).
 * 31.12.2027 23:59 po crnogorskom vremenu (CET) = 22:59:59.999Z.
 */
export const PROMO_FREE_PRO_END_MS = Date.parse('2027-12-31T22:59:59.999Z')

export function registrationGetsFreePro(registeredAt: Date): boolean {
  return registeredAt.getTime() <= PROMO_FREE_PRO_END_MS
}

export function addOneYearIsoFrom(date: Date): string {
  const d = new Date(date.getTime())
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString()
}

/** `YYYY-MM-DD` za kraj pretplate (iz ISO `validUntil` u profilu); fallback +1 god. od danas. */
export function subscriptionValidUntilYmd(validUntil: string | undefined | null): string {
  const v = typeof validUntil === 'string' ? validUntil.trim() : ''
  if (v) {
    const d = new Date(v)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}
