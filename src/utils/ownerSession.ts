import type { ListingCategory } from '../types'
import type { SubscriptionPlan } from '../types/plan'
import { isSubscriptionPlan } from '../types/plan'
import {
  ACCOMMODATION_DRAFT_LISTING_ID,
  ACCOMMODATION_DRAFT_LS_KEY,
  ownerAccommodationPublicListingId,
  ownerCarPublicListingId,
  ownerMotorcyclePublicListingId,
} from './accommodationDraft'
import { setLoggedIn } from './storage'
import { setListingInquiryNotifyEmail } from './visitorInquiries'
import { setOwnerAvatarPublic } from './ownerAvatarPublic'

const PROFILE_KEY = 'rentadria_owner_profile'
const LISTINGS_KEY = 'rentadria_owner_listings_by_user'

export type OwnerProfile = {
  userId: string
  email: string
  displayName: string
  /** `null` until the owner completes subscription (payment). */
  plan: SubscriptionPlan | null
  /**
   * `false` for new accounts until subscription is activated.
   * Omitted in stored legacy data → treated as active when a plan exists.
   */
  subscriptionActive?: boolean
  /**
   * **Basic** plan only: the single category the owner chose (required before listings).
   * `null` = must pick on dashboard. Legacy Basic users without this field get `accommodation`.
   */
  basicCategoryChoice?: ListingCategory | null
  registeredAt: string
  validUntil: string
  /** Kontakt telefon vlasnika (Postavke profila). */
  phone?: string
  /** Profilna slika / logo (data URL), prikaz pored kontakta na oglasu. */
  avatarDataUrl?: string | null
  /** SHA-256 hex trenutne lozinke; ako postoji, prijava zahtijeva ispravnu lozinku. */
  passwordHash?: string
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

/** Categories the owner may use (after payment + Basic category choice when applicable). */
export function getEffectiveUnlockedCategories(profile: OwnerProfile): ListingCategory[] {
  if (!profile.subscriptionActive || profile.plan == null) return []
  if (profile.plan === 'basic') {
    const cat = profile.basicCategoryChoice
    if (cat === 'accommodation' || cat === 'car' || cat === 'motorcycle') return [cat]
    return []
  }
  return ['accommodation', 'car', 'motorcycle']
}

export function activateOwnerSubscription(profile: OwnerProfile, plan: SubscriptionPlan): void {
  saveOwnerProfile({
    ...profile,
    plan,
    subscriptionActive: true,
    validUntil: addOneYearIso(),
    basicCategoryChoice: plan === 'basic' ? null : undefined,
  })
}

export function saveBasicCategoryChoice(profile: OwnerProfile, cat: ListingCategory): void {
  if (profile.plan !== 'basic' || !profile.subscriptionActive) return
  saveOwnerProfile({
    ...profile,
    basicCategoryChoice: cat,
  })
}

/** Max active listings per category for owner table (demo limits). */
export function maxListingsPerCategoryForPlan(plan: SubscriptionPlan): number {
  if (plan === 'basic') return 2
  if (plan === 'pro') return 5
  return 999
}

export type UpsertOwnerAccResult =
  | { ok: true; rowId: string }
  | { ok: false; reason: 'limit' }

/**
 * Saves or updates one accommodation row on the owner dashboard and points „Pogledaj“
 * to the shared accommodation draft preview (`owner-draft-accommodation`).
 */
export function upsertOwnerAccommodationListingRow(opts: {
  userId: string
  plan: SubscriptionPlan | null
  /** From a previous save in this modal session — update instead of append */
  existingRowId: string | null
  title: string
  receivedAtYmd: string
  expiresAtYmd: string
}): UpsertOwnerAccResult {
  if (!opts.plan) return { ok: false, reason: 'limit' }
  const m = loadListingsMap()
  const arr = [...(m[opts.userId] ?? [])]

  const toDots = (ymd: string) =>
    formatDateDots(ymd.includes('T') ? ymd : `${ymd}T12:00:00.000Z`)

  if (opts.existingRowId) {
    const i = arr.findIndex((x) => x.id === opts.existingRowId)
    if (i >= 0) {
      arr[i] = {
        ...arr[i]!,
        title: opts.title,
        receivedAt: toDots(opts.receivedAtYmd),
        expiresAt: toDots(opts.expiresAtYmd),
        publicListingId: ownerAccommodationPublicListingId(opts.existingRowId),
      }
      m[opts.userId] = arr
      saveListingsMap(m)
      return { ok: true, rowId: opts.existingRowId }
    }
  }

  const accCount = arr.filter((x) => x.category === 'accommodation').length
  const max = maxListingsPerCategoryForPlan(opts.plan)
  if (accCount >= max) {
    return { ok: false, reason: 'limit' }
  }

  const id = `own-${opts.userId}-acc-${Date.now()}`
  arr.push({
    id,
    userId: opts.userId,
    category: 'accommodation',
    title: opts.title,
    viewsMonth: 0,
    contactClicksMonth: 0,
    receivedAt: toDots(opts.receivedAtYmd),
    expiresAt: toDots(opts.expiresAtYmd),
    featuredUntil: null,
    internalNote: null,
    publicListingId: ownerAccommodationPublicListingId(id),
  })
  m[opts.userId] = arr
  saveListingsMap(m)
  return { ok: true, rowId: id }
}

/**
 * Saves or updates one car rental row on the owner dashboard and points „Pogledaj“
 * to the car draft preview (`owner-draft-car-…`).
 */
export function upsertOwnerCarListingRow(opts: {
  userId: string
  plan: SubscriptionPlan | null
  existingRowId: string | null
  title: string
  receivedAtYmd: string
  expiresAtYmd: string
}): UpsertOwnerAccResult {
  if (!opts.plan) return { ok: false, reason: 'limit' }
  const m = loadListingsMap()
  const arr = [...(m[opts.userId] ?? [])]

  const toDots = (ymd: string) =>
    formatDateDots(ymd.includes('T') ? ymd : `${ymd}T12:00:00.000Z`)

  if (opts.existingRowId) {
    const i = arr.findIndex((x) => x.id === opts.existingRowId)
    if (i >= 0) {
      arr[i] = {
        ...arr[i]!,
        title: opts.title,
        receivedAt: toDots(opts.receivedAtYmd),
        expiresAt: toDots(opts.expiresAtYmd),
        publicListingId: ownerCarPublicListingId(opts.existingRowId),
      }
      m[opts.userId] = arr
      saveListingsMap(m)
      return { ok: true, rowId: opts.existingRowId }
    }
  }

  const carCount = arr.filter((x) => x.category === 'car').length
  const max = maxListingsPerCategoryForPlan(opts.plan)
  if (carCount >= max) {
    return { ok: false, reason: 'limit' }
  }

  const id = `own-${opts.userId}-car-${Date.now()}`
  arr.push({
    id,
    userId: opts.userId,
    category: 'car',
    title: opts.title,
    viewsMonth: 0,
    contactClicksMonth: 0,
    receivedAt: toDots(opts.receivedAtYmd),
    expiresAt: toDots(opts.expiresAtYmd),
    featuredUntil: null,
    internalNote: null,
    publicListingId: ownerCarPublicListingId(id),
  })
  m[opts.userId] = arr
  saveListingsMap(m)
  return { ok: true, rowId: id }
}

/**
 * Saves or updates one motorcycle rental row and points „Pogledaj“ to the moto draft preview.
 */
export function upsertOwnerMotorcycleListingRow(opts: {
  userId: string
  plan: SubscriptionPlan | null
  existingRowId: string | null
  title: string
  receivedAtYmd: string
  expiresAtYmd: string
}): UpsertOwnerAccResult {
  if (!opts.plan) return { ok: false, reason: 'limit' }
  const m = loadListingsMap()
  const arr = [...(m[opts.userId] ?? [])]

  const toDots = (ymd: string) =>
    formatDateDots(ymd.includes('T') ? ymd : `${ymd}T12:00:00.000Z`)

  if (opts.existingRowId) {
    const i = arr.findIndex((x) => x.id === opts.existingRowId)
    if (i >= 0) {
      arr[i] = {
        ...arr[i]!,
        title: opts.title,
        receivedAt: toDots(opts.receivedAtYmd),
        expiresAt: toDots(opts.expiresAtYmd),
        publicListingId: ownerMotorcyclePublicListingId(opts.existingRowId),
      }
      m[opts.userId] = arr
      saveListingsMap(m)
      return { ok: true, rowId: opts.existingRowId }
    }
  }

  const motoCount = arr.filter((x) => x.category === 'motorcycle').length
  const max = maxListingsPerCategoryForPlan(opts.plan)
  if (motoCount >= max) {
    return { ok: false, reason: 'limit' }
  }

  const id = `own-${opts.userId}-moto-${Date.now()}`
  arr.push({
    id,
    userId: opts.userId,
    category: 'motorcycle',
    title: opts.title,
    viewsMonth: 0,
    contactClicksMonth: 0,
    receivedAt: toDots(opts.receivedAtYmd),
    expiresAt: toDots(opts.expiresAtYmd),
    featuredUntil: null,
    internalNote: null,
    publicListingId: ownerMotorcyclePublicListingId(id),
  })
  m[opts.userId] = arr
  saveListingsMap(m)
  return { ok: true, rowId: id }
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
    const p = JSON.parse(raw) as Partial<OwnerProfile> & Record<string, unknown>
    if (typeof p.userId !== 'string' || typeof p.email !== 'string') return null

    const displayName =
      typeof p.displayName === 'string' && p.displayName.trim()
        ? p.displayName
        : (p.email.split('@')[0] ?? '—')
    const registeredAt =
      typeof p.registeredAt === 'string' ? p.registeredAt : new Date().toISOString()
    const validUntil =
      typeof p.validUntil === 'string' ? p.validUntil : addOneYearIso()

    let storedPlan: SubscriptionPlan | null = null
    if (isSubscriptionPlan(p.plan as string)) {
      storedPlan = p.plan as SubscriptionPlan
    }

    const explicitSubscriptionFlag = typeof p.subscriptionActive === 'boolean'
    let subscriptionActive = explicitSubscriptionFlag ? p.subscriptionActive! : storedPlan != null

    const effectivePlan = subscriptionActive ? storedPlan : null

    let basicCategoryChoice: ListingCategory | null | undefined
    if (
      p.basicCategoryChoice === 'accommodation' ||
      p.basicCategoryChoice === 'car' ||
      p.basicCategoryChoice === 'motorcycle'
    ) {
      basicCategoryChoice = p.basicCategoryChoice
    } else {
      basicCategoryChoice = undefined
    }

    if (effectivePlan === 'basic') {
      if (basicCategoryChoice === undefined || basicCategoryChoice === null) {
        // Legacy Basic (no flag / no choice): previously only accommodation existed
        basicCategoryChoice = !explicitSubscriptionFlag && subscriptionActive ? 'accommodation' : null
      }
    } else {
      basicCategoryChoice = undefined
    }

    const phone = typeof p.phone === 'string' ? p.phone : undefined
    const avatarDataUrl =
      p.avatarDataUrl === null
        ? null
        : typeof p.avatarDataUrl === 'string'
          ? p.avatarDataUrl
          : undefined
    const passwordHash = typeof p.passwordHash === 'string' ? p.passwordHash : undefined

    return {
      userId: p.userId,
      email: p.email,
      displayName,
      plan: effectivePlan,
      subscriptionActive,
      basicCategoryChoice:
        effectivePlan === 'basic'
          ? basicCategoryChoice === undefined
            ? null
            : basicCategoryChoice
          : undefined,
      registeredAt,
      validUntil,
      phone,
      avatarDataUrl,
      passwordHash,
    }
  } catch {
    return null
  }
}

export function saveOwnerProfile(p: OwnerProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
  setLoggedIn(true)
  try {
    if (p.avatarDataUrl && p.avatarDataUrl.length > 0) {
      setOwnerAvatarPublic(p.userId, p.avatarDataUrl)
    } else if (p.avatarDataUrl === null || p.avatarDataUrl === '') {
      setOwnerAvatarPublic(p.userId, null)
    }
  } catch {
    /* ignore */
  }
}

export function clearOwnerSession(): void {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as { userId?: string }
      if (typeof p.userId === 'string') {
        setOwnerAvatarPublic(p.userId, null)
      }
    }
  } catch {
    /* ignore */
  }
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

/** Svi redovi svih korisnika (za javnu pretragu / spajanje s oglasima). */
export function getAllOwnerListingRows(): OwnerListingRow[] {
  const m = loadListingsMap()
  return Object.values(m).flat()
}

export function getOwnerListings(userId: string): OwnerListingRow[] {
  const m = loadListingsMap()
  const arr = m[userId] ?? []
  let changed = false
  const next = arr.map((r) => {
    if (
      r.category === 'accommodation' &&
      r.publicListingId === ACCOMMODATION_DRAFT_LISTING_ID
    ) {
      changed = true
      return { ...r, publicListingId: ownerAccommodationPublicListingId(r.id) }
    }
    return r
  })
  if (changed) {
    const accRows = next.filter((r) => r.category === 'accommodation')
    if (accRows.length === 1) {
      const only = accRows[0]!
      const rowKey = `${ACCOMMODATION_DRAFT_LS_KEY}::${only.id}`
      try {
        if (!localStorage.getItem(rowKey)) {
          const globalDraft = localStorage.getItem(ACCOMMODATION_DRAFT_LS_KEY)
          if (globalDraft) localStorage.setItem(rowKey, globalDraft)
        }
      } catch {
        /* ignore */
      }
    }
    m[userId] = next
    saveListingsMap(m)
  }
  return next
}

/** Demo row so dashboard matches expectations; only when user has zero listings */
export function formatDateDots(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

export function seedOwnerListingsIfEmpty(profile: OwnerProfile) {
  if (!profile.subscriptionActive || profile.plan == null) return
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
  setListingInquiryNotifyEmail('a1', profile.email)
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
