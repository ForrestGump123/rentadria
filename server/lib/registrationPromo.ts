/**
 * Kraj promo perioda po crnogorskom vremenu (Europe/Podgorica) u 23:59.
 * 31.12.2027 u Podgorici je CET (UTC+1) → 22:59:59.999Z.
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
