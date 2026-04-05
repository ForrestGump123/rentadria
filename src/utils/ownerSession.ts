import type { SearchCountryId } from '../data/cities/countryIds'
import { SEARCH_COUNTRY_IDS } from '../data/cities/countryIds'
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
import { recordAdminContactClick } from './adminEngagementStore'
import {
  clearAdminOwnerMeta,
  extraCategoryFlags,
  extraListingsForCategory,
  getAdminOwnerMeta,
  setAdminOwnerMeta,
} from './adminOwnerMeta'
import {
  getDeletedOwner,
  isOwnerDeleted,
  pushDeletedOwner,
  removeDeletedOwner,
  type DeletedOwnerRecord,
} from './deletedOwnersStore'

const PROFILE_KEY = 'rentadria_owner_profile'
const LISTINGS_KEY = 'rentadria_owner_listings_by_user'
const PROFILES_MAP_KEY = 'rentadria_owner_profiles_by_user'

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
  /**
   * Promotivni kod: ako je u adminu označena samo jedna ili više kategorija (ne sve),
   * ograničenje koje kategorije se smiju koristiti (Pro benefit samo u tom opsegu).
   */
  promoCategoryScope?: ListingCategory[] | null
  registeredAt: string
  validUntil: string
  /** Kontakt telefon vlasnika (Postavke profila). */
  phone?: string
  /** Profilna slika / logo (data URL), prikaz pored kontakta na oglasu. */
  avatarDataUrl?: string | null
  /** SHA-256 hex trenutne lozinke; ako postoji, prijava zahtijeva ispravnu lozinku. */
  passwordHash?: string
  /** Država vlasnika (admin filter / prikaz). */
  countryId?: SearchCountryId
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
  let base: ListingCategory[]
  if (profile.plan === 'basic') {
    const cat = profile.basicCategoryChoice
    if (cat === 'accommodation' || cat === 'car' || cat === 'motorcycle') base = [cat]
    else base = []
  } else {
    base = ['accommodation', 'car', 'motorcycle']
  }
  const ex = extraCategoryFlags(getAdminOwnerMeta(profile.userId))
  const set = new Set(base)
  if (ex.accommodation) set.add('accommodation')
  if (ex.car) set.add('car')
  if (ex.motorcycle) set.add('motorcycle')
  let result = Array.from(set)
  const scope = profile.promoCategoryScope
  if (scope && scope.length > 0) {
    const allow = new Set(scope)
    result = result.filter((c) => allow.has(c))
  }
  return result
}

export function activateOwnerSubscription(profile: OwnerProfile, plan: SubscriptionPlan): void {
  saveOwnerProfile({
    ...profile,
    plan,
    subscriptionActive: true,
    validUntil: addOneYearIso(),
    basicCategoryChoice: plan === 'basic' ? null : undefined,
    promoCategoryScope: undefined,
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

/** Bazni limit + admin dopune (tab Vlasnici). */
export function maxListingsForOwnerCategory(
  userId: string,
  plan: SubscriptionPlan,
  category: ListingCategory,
): number {
  const base = maxListingsPerCategoryForPlan(plan)
  return base + extraListingsForCategory(getAdminOwnerMeta(userId), category)
}

export type UpsertOwnerAccResult =
  | { ok: true; rowId: string }
  | { ok: false; reason: 'limit' | 'blocked' }

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
  if (getAdminOwnerMeta(opts.userId).blocked) return { ok: false, reason: 'blocked' }
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
  const max = maxListingsForOwnerCategory(opts.userId, opts.plan, 'accommodation')
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
  if (getAdminOwnerMeta(opts.userId).blocked) return { ok: false, reason: 'blocked' }
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
  const max = maxListingsForOwnerCategory(opts.userId, opts.plan, 'car')
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
  if (getAdminOwnerMeta(opts.userId).blocked) return { ok: false, reason: 'blocked' }
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
  const max = maxListingsForOwnerCategory(opts.userId, opts.plan, 'motorcycle')
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

export function addMonthsIso(months: number, from = new Date()): string {
  const d = new Date(from)
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}

/**
 * Uskladi plan/pretplatu nakon admin dodjele ili starog stanja u localStorage.
 * Ako postoji plan, pretplata je aktivna; Basic bez kategorije → smještaj.
 */
export function normalizeOwnerProfileForSession(p: OwnerProfile): OwnerProfile {
  let plan: SubscriptionPlan | null = null
  if (p.plan != null && isSubscriptionPlan(p.plan)) {
    plan = p.plan
  }
  if (plan == null) {
    return {
      ...p,
      plan: null,
      subscriptionActive: false,
      basicCategoryChoice: undefined,
      promoCategoryScope: undefined,
    }
  }
  let next: OwnerProfile = {
    ...p,
    plan,
    subscriptionActive: true,
  }
  if (plan === 'basic') {
    const bc = next.basicCategoryChoice
    if (bc !== 'accommodation' && bc !== 'car' && bc !== 'motorcycle') {
      next = { ...next, basicCategoryChoice: 'accommodation' }
    }
  } else {
    next = { ...next, basicCategoryChoice: undefined }
  }
  return next
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
    const subscriptionActive = explicitSubscriptionFlag ? p.subscriptionActive! : storedPlan != null

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

    const phone = typeof p.phone === 'string' ? p.phone : undefined
    const avatarDataUrl =
      p.avatarDataUrl === null
        ? null
        : typeof p.avatarDataUrl === 'string'
          ? p.avatarDataUrl
          : undefined
    const passwordHash = typeof p.passwordHash === 'string' ? p.passwordHash : undefined

    let countryId: SearchCountryId | undefined
    if (
      typeof p.countryId === 'string' &&
      (SEARCH_COUNTRY_IDS as readonly string[]).includes(p.countryId)
    ) {
      countryId = p.countryId as SearchCountryId
    }

    let promoCategoryScope: ListingCategory[] | undefined
    if (Array.isArray(p.promoCategoryScope)) {
      const valid: ListingCategory[] = ['accommodation', 'car', 'motorcycle']
      const picked = p.promoCategoryScope.filter((x): x is ListingCategory =>
        valid.includes(x as ListingCategory),
      )
      if (picked.length > 0) promoCategoryScope = picked
    }

    const draft: OwnerProfile = {
      userId: p.userId,
      email: p.email,
      displayName,
      plan: storedPlan,
      subscriptionActive,
      basicCategoryChoice:
        storedPlan === 'basic'
          ? basicCategoryChoice === undefined
            ? null
            : basicCategoryChoice
          : undefined,
      registeredAt,
      validUntil,
      phone,
      avatarDataUrl,
      passwordHash,
      countryId,
      promoCategoryScope,
    }
    return normalizeOwnerProfileForSession(draft)
  } catch {
    return null
  }
}

function loadOwnerProfilesMap(): Record<string, OwnerProfile> {
  try {
    const raw = localStorage.getItem(PROFILES_MAP_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, OwnerProfile>
  } catch {
    return {}
  }
}

function saveOwnerProfilesMap(m: Record<string, OwnerProfile>) {
  localStorage.setItem(PROFILES_MAP_KEY, JSON.stringify(m))
}

/** Javni profil po userId (admin + više naloga u istom browseru). */
export function getOwnerProfileByUserId(userId: string): OwnerProfile | null {
  const map = loadOwnerProfilesMap()
  const p = map[userId]
  if (!p) return null
  return normalizeOwnerProfileForSession({ ...p })
}

export function findOwnerProfileByEmail(email: string): OwnerProfile | null {
  const em = email.trim().toLowerCase()
  const cur = getOwnerProfile()
  if (cur && cur.email.trim().toLowerCase() === em) return cur
  const map = loadOwnerProfilesMap()
  for (const p of Object.values(map)) {
    if (p.email.trim().toLowerCase() === em) return normalizeOwnerProfileForSession({ ...p })
  }
  return null
}

function minimalOwnerProfile(userId: string): OwnerProfile {
  const safe = userId.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 48) || 'owner'
  const looksEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userId.trim())
  const email = looksEmail ? userId.trim() : `${safe}@owner.local`
  const displayName = looksEmail ? (userId.split('@')[0] ?? safe) : safe
  return {
    userId,
    email,
    displayName,
    plan: null,
    subscriptionActive: false,
    registeredAt: new Date().toISOString(),
    validUntil: addOneYearIso(),
  }
}

export function getAllOwnerUserIds(): string[] {
  const m = loadListingsMap()
  const fromListings = Object.keys(m)
  const fromProfiles = Object.keys(loadOwnerProfilesMap())
  return Array.from(new Set([...fromListings, ...fromProfiles]))
}

export function getAllOwnerProfilesForAdmin(): OwnerProfile[] {
  return getAllOwnerUserIds().map((id) => getOwnerProfileByUserId(id) ?? minimalOwnerProfile(id))
}

export function saveOwnerProfileForAdmin(userId: string, p: OwnerProfile): void {
  const next = normalizeOwnerProfileForSession({ ...p, userId })
  const map = loadOwnerProfilesMap()
  map[userId] = next
  saveOwnerProfilesMap(map)
  try {
    const cur = getOwnerProfile()
    if (cur?.userId === userId) {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(next))
    }
  } catch {
    /* ignore */
  }
  try {
    if (next.avatarDataUrl && next.avatarDataUrl.length > 0) {
      setOwnerAvatarPublic(next.userId, next.avatarDataUrl)
    } else if (next.avatarDataUrl === null || next.avatarDataUrl === '') {
      setOwnerAvatarPublic(next.userId, null)
    }
  } catch {
    /* ignore */
  }
}

/** Javni prikaz oglasa: sakrij ako je vlasnik obrisan (soft) ili blokiran. */
export function isOwnerPublicListingVisible(userId: string): boolean {
  if (isOwnerDeleted(userId)) return false
  if (getAdminOwnerMeta(userId).blocked) return false
  return true
}

export function softDeleteOwnerUser(userId: string): void {
  const map = loadOwnerProfilesMap()
  const raw = map[userId]
  if (!raw) return
  const lm = loadListingsMap()
  const listings = [...(lm[userId] ?? [])]
  const meta = getAdminOwnerMeta(userId)
  const rec: DeletedOwnerRecord = {
    userId,
    deletedAt: new Date().toISOString(),
    profile: { ...raw },
    listings,
    meta: { ...meta },
  }
  pushDeletedOwner(rec)
  delete lm[userId]
  saveListingsMap(lm)
  delete map[userId]
  saveOwnerProfilesMap(map)
  clearAdminOwnerMeta(userId)
  try {
    const cur = getOwnerProfile()
    if (cur?.userId === userId) clearOwnerSession()
  } catch {
    /* ignore */
  }
}

export function restoreDeletedOwner(userId: string): boolean {
  const rec = getDeletedOwner(userId)
  if (!rec) return false
  saveOwnerProfileForAdmin(userId, rec.profile)
  const lm = loadListingsMap()
  lm[userId] = rec.listings.map((x) => ({ ...x }))
  saveListingsMap(lm)
  setAdminOwnerMeta(userId, rec.meta)
  removeDeletedOwner(userId)
  return true
}

export function permanentlyEraseDeletedOwnerRecord(userId: string): void {
  removeDeletedOwner(userId)
}

export function adminDeleteOwnerUser(userId: string): void {
  const m = loadListingsMap()
  delete m[userId]
  saveListingsMap(m)
  const map = loadOwnerProfilesMap()
  delete map[userId]
  saveOwnerProfilesMap(map)
  try {
    const cur = getOwnerProfile()
    if (cur?.userId === userId) {
      clearOwnerSession()
    }
  } catch {
    /* ignore */
  }
  clearAdminOwnerMeta(userId)
}

export function saveOwnerProfile(p: OwnerProfile): void {
  const next = normalizeOwnerProfileForSession(p)
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next))
  const map = loadOwnerProfilesMap()
  map[next.userId] = next
  saveOwnerProfilesMap(map)
  setLoggedIn(true)
  try {
    if (next.avatarDataUrl && next.avatarDataUrl.length > 0) {
      setOwnerAvatarPublic(next.userId, next.avatarDataUrl)
    } else if (next.avatarDataUrl === null || next.avatarDataUrl === '') {
      setOwnerAvatarPublic(next.userId, null)
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

/** Ako postoji vlasnički red s ovim javnim ID-jem i vlasnik je blokiran/obrisan, sakrij oglas na sajtu. */
export function listingSuppressedOnPublicSite(listingId: string): boolean {
  for (const r of getAllOwnerListingRows()) {
    if (r.publicListingId === listingId && !isOwnerPublicListingVisible(r.userId)) return true
  }
  return false
}

/** Svaki klik „Prikaži kontakt“ na javnom oglasu (listingId = javni ID oglasa). */
export function incrementContactClickForListing(listingId: string): void {
  const m = loadListingsMap()
  for (const uid of Object.keys(m)) {
    const arr = m[uid]
    if (!arr) continue
    const i = arr.findIndex((r) => r.publicListingId === listingId)
    if (i < 0) continue
    const r = arr[i]!
    arr[i] = { ...r, contactClicksMonth: (r.contactClicksMonth ?? 0) + 1 }
    m[uid] = arr
    saveListingsMap(m)
    recordAdminContactClick(uid)
    try {
      window.dispatchEvent(new Event('rentadria-owner-listings-updated'))
    } catch {
      /* ignore */
    }
    return
  }
}

/** Svaki prikaz stranice oglasa — povećava mjesečni broj pregleda za taj oglas. */
export function incrementListingViewForListing(listingId: string): void {
  const m = loadListingsMap()
  for (const uid of Object.keys(m)) {
    const arr = m[uid]
    if (!arr) continue
    const i = arr.findIndex((r) => r.publicListingId === listingId)
    if (i < 0) continue
    const r = arr[i]!
    arr[i] = { ...r, viewsMonth: (r.viewsMonth ?? 0) + 1 }
    m[uid] = arr
    saveListingsMap(m)
    try {
      window.dispatchEvent(new Event('rentadria-owner-listings-updated'))
    } catch {
      /* ignore */
    }
    return
  }
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
  if (getAdminOwnerMeta(profile.userId).blocked) return
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
      viewsMonth: 0,
      contactClicksMonth: 0,
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
