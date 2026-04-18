/** Isti kraj promotivnog perioda kao na serveru (`server/lib/registrationPromo.ts`). */
export const PROMO_FREE_PRO_END_MS = Date.parse('2027-12-31T23:59:59.999Z')

export function registrationGetsFreePro(registeredAt: Date): boolean {
  return registeredAt.getTime() <= PROMO_FREE_PRO_END_MS
}

export function addOneYearIsoFrom(date: Date): string {
  const d = new Date(date.getTime())
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString()
}
