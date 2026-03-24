import type { ListingCategory } from '../types'
import type { SubscriptionPlan } from '../types/plan'
import { isSubscriptionPlan } from '../types/plan'
import { setLoggedIn } from './storage'

const PROFILE_KEY = 'rentadria_owner_profile'
const LISTINGS_KEY = 'rentadria_owner_listings_by_user'

export type OwnerProfile = {
  userId: string
  email: string
  displayName: string
  plan: SubscriptionPlan
  registeredAt: string
  validUntil: string
}

export type OwnerListingRow = {
  id: string
  userId: string
  category: ListingCategory
  title: string
  viewsMonth: number
  contactClicksMonth: number
  receivedAt: string
  expiresAt: string
  featuredUntil: string | null
  internalNote: string | null
  /** If set, „Pogledaj“ opens this public listing */
  publicListingId?: string
}

export function getUnlockedCategories(plan: SubscriptionPlan): ListingCategory[] {
  if (plan === 'basic') return ['accommodation']
  return ['accommodation', 'car', 'motorcycle']
}

export function addOneYearIso(from = new Date()): string {
  const d = new Date(from)
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString()
}

export function getOwnerProfile(): OwnerProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as OwnerProfile
    if (!p.userId || !p.email || !isSubscriptionPlan(p.plan)) return null
    return p
  } catch {
    return null
  }
}

export function saveOwnerProfile(p: OwnerProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
  setLoggedIn(true)
}

export function clearOwnerSession(): void {
  localStorage.removeItem(PROFILE_KEY)
  setLoggedIn(false)
}

function loadListingsMap(): Record<string, OwnerListingRow[]> {
  try {
    const raw = localStorage.getItem(LISTINGS_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, OwnerListingRow[]>
  } catch {
    return {}
  }
}

function saveListingsMap(m: Record<string, OwnerListingRow[]>) {
  localStorage.setItem(LISTINGS_KEY, JSON.stringify(m))
}

export function getOwnerListings(userId: string): OwnerListingRow[] {
  return loadListingsMap()[userId] ?? []
}

/** Demo row so dashboard matches expectations; only when user has zero listings */
export function formatDateDots(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

export function seedOwnerListingsIfEmpty(profile: OwnerProfile) {
  const m = loadListingsMap()
  if (m[profile.userId]?.length) return

  const recvStr = formatDateDots(profile.registeredAt)
  const expires = formatDateDots(profile.validUntil)

  m[profile.userId] = [
    {
      id: `own-${profile.userId}-acc-1`,
      userId: profile.userId,
      category: 'accommodation',
      title: 'Jednosoban stan',
      viewsMonth: 3463,
      contactClicksMonth: 4,
      receivedAt: recvStr,
      expiresAt: expires,
      featuredUntil: null,
      internalNote: null,
      publicListingId: 'a1',
    },
  ]
  saveListingsMap(m)
}

export function deleteOwnerListing(userId: string, listingId: string) {
  const m = loadListingsMap()
  const arr = m[userId]
  if (!arr) return
  m[userId] = arr.filter((x) => x.id !== listingId)
  saveListingsMap(m)
}

export function displayFirstName(full: string): string {
  const t = full.trim()
  if (!t) return '—'
  return t.split(/\s+/)[0]
}
