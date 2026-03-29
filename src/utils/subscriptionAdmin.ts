import type { SearchCountryId } from '../data/cities/countryIds'
import type { OwnerProfile } from './ownerSession'

/** Dani do isteka pretplate; null ako nema aktivnog plana / datuma. */
export function daysUntilSubscriptionEnd(p: OwnerProfile): number | null {
  if (!p.plan || p.subscriptionActive === false) return null
  const end = new Date(p.validUntil).getTime()
  if (Number.isNaN(end)) return null
  return Math.ceil((end - Date.now()) / 86_400_000)
}

/** Pretplata istekla po datumu (bez obzira na flag). */
export function isSubscriptionDateExpired(p: OwnerProfile): boolean {
  if (!p.plan) return false
  const end = new Date(p.validUntil).getTime()
  if (Number.isNaN(end)) return false
  return end < Date.now()
}

/** Aktivna pretplata koja još traje. */
export function hasActiveSubscriptionWindow(p: OwnerProfile): boolean {
  if (!p.plan || p.subscriptionActive === false) return false
  return !isSubscriptionDateExpired(p)
}

export function filterByCountry<T extends { countryId?: SearchCountryId }>(
  list: T[],
  country: 'all' | SearchCountryId,
): T[] {
  if (country === 'all') return list
  return list.filter((x) => x.countryId === country)
}

export function matchesOwnerSearch(p: OwnerProfile, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return (
    p.displayName.toLowerCase().includes(s) ||
    p.email.toLowerCase().includes(s) ||
    (p.phone ?? '').toLowerCase().includes(s) ||
    (p.phone ?? '').replace(/\D/g, '').includes(s.replace(/\D/g, ''))
  )
}
