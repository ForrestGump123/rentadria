import { getListingById } from '../data/listings'
import type { Listing } from '../types'
import type { ListingCategory } from '../types'
import { getAllOwnerListingRows } from './ownerSession'

/** Kategorija stranice na kojoj se reklama prikazuje */
export type AdCategory = ListingCategory

export type AdPlacement = 'slideshow' | 'featured' | 'sideSlideshow'

const STORAGE_KEY = 'rentadria_owner_ad_bookings_v1'

/** Trajanje jedne reklame (dana) i pauza prije novog zakupa istog vlasnika u istoj kategoriji */
export const AD_DURATION_DAYS = 15
export const AD_COOLDOWN_DAYS = 15
export const AD_PRICE_EUR = 15

export type OwnerAdBooking = {
  id: string
  ownerUserId: string
  category: AdCategory
  placements: AdPlacement[]
  /** Početak prvog dana reklame (ISO, lokalni dan) */
  startAt: string
  /** Kraj uključujući posljednji dan (ISO kraj dana ili početak dana nakon) */
  endAt: string
  createdAt: string
  /** Demo: nakon uplate bi bilo true */
  paid: boolean
}

function load(): OwnerAdBooking[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const a = JSON.parse(raw) as unknown
    return Array.isArray(a) ? (a as OwnerAdBooking[]) : []
  } catch {
    return []
  }
}

function save(rows: OwnerAdBooking[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  try {
    window.dispatchEvent(new Event('rentadria-owner-ads-updated'))
  } catch {
    /* ignore */
  }
}

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function startOfDayLocal(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function addDaysLocal(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return startOfDayLocal(x)
}

/** Završetak perioda od `start` uključujući AD_DURATION_DAYS kalendarskih dana (end = start + duration - 1 dan zadnji uključen) */
export function bookingEndStart(start: Date): Date {
  return addDaysLocal(start, AD_DURATION_DAYS - 1)
}

/** Prvi dan nakon isteka reklame (za sljedeći globalni slot) */
export function dayAfterBookingEnd(endDay: Date): Date {
  return addDaysLocal(endDay, 1)
}

/**
 * Sljedeći slobodni početak termina za kategoriju (globalni red),
 * zatim ograničenje: isti vlasnik +15 dana nakon isteka posljednje reklame u toj kategoriji.
 */
export function computeNextSlotStart(ownerUserId: string, category: AdCategory): Date {
  const all = load()
  const forCat = all.filter((b) => b.category === category)
  let globalNext = startOfDayLocal(new Date())

  if (forCat.length > 0) {
    const lastEnd = forCat.reduce((max, b) => {
      const e = new Date(b.endAt).getTime()
      return e > max ? e : max
    }, 0)
    const afterLast = dayAfterBookingEnd(startOfDayLocal(new Date(lastEnd)))
    if (afterLast.getTime() > globalNext.getTime()) globalNext = afterLast
  }

  const ownInCat = forCat
    .filter((b) => b.ownerUserId === ownerUserId)
    .sort((a, b) => new Date(b.endAt).getTime() - new Date(a.endAt).getTime())
  if (ownInCat.length > 0) {
    const lastOwnEnd = startOfDayLocal(new Date(ownInCat[0]!.endAt))
    const afterCooldown = addDaysLocal(lastOwnEnd, AD_COOLDOWN_DAYS)
    if (afterCooldown.getTime() > globalNext.getTime()) globalNext = afterCooldown
  }

  return globalNext
}

export function listBookings(): OwnerAdBooking[] {
  return load()
}

/** Demo: simulacija uplate — dodaje zakup */
export function createDemoBooking(opts: {
  ownerUserId: string
  category: AdCategory
  placements: AdPlacement[]
}): OwnerAdBooking | null {
  if (!opts.placements.length) return null
  const start = computeNextSlotStart(opts.ownerUserId, opts.category)
  const end = bookingEndStart(start)
  const row: OwnerAdBooking = {
    id: newId(),
    ownerUserId: opts.ownerUserId,
    category: opts.category,
    placements: [...opts.placements],
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    createdAt: new Date().toISOString(),
    paid: true,
  }
  const all = load()
  all.push(row)
  save(all)
  return row
}

export function formatAdSlotDate(d: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d)
  } catch {
    return d.toLocaleDateString()
  }
}

/** Da li je zakup aktivan na današnji dan (uključujući posljednji dan perioda). */
export function isBookingActiveNow(b: OwnerAdBooking): boolean {
  if (!b.paid) return false
  const now = startOfDayLocal(new Date())
  const s = startOfDayLocal(new Date(b.startAt))
  const e = startOfDayLocal(new Date(b.endAt))
  return now.getTime() >= s.getTime() && now.getTime() <= e.getTime()
}

export function getActiveBookingsNow(): OwnerAdBooking[] {
  return load().filter(isBookingActiveNow)
}

export function getActiveBookingsForCategory(cat: AdCategory): OwnerAdBooking[] {
  return getActiveBookingsNow().filter((b) => b.category === cat)
}

/**
 * Javni oglas vlasnika za ovu kategoriju (prvi red sa `publicListingId`).
 * Bez objavljenog oglasa reklama se ne može prikazati na početnoj.
 */
export function resolveListingForAdBooking(booking: OwnerAdBooking): Listing | undefined {
  const rows = getAllOwnerListingRows().filter(
    (r) =>
      r.userId === booking.ownerUserId &&
      r.category === booking.category &&
      r.publicListingId,
  )
  if (!rows.length) return undefined
  const pid = rows[0]!.publicListingId!
  return getListingById(pid)
}

function dedupeListingsById(listings: Listing[]): Listing[] {
  const seen = new Set<string>()
  const out: Listing[] = []
  for (const l of listings) {
    if (seen.has(l.id)) continue
    seen.add(l.id)
    out.push(l)
  }
  return out
}

/** Oglasi za prikaz na početnoj po vrsti zakupa i trenutnoj kategoriji taba. */
export function getPromotedListingsForPlacement(
  category: ListingCategory,
  placement: AdPlacement,
): Listing[] {
  const bookings = getActiveBookingsForCategory(category).filter((b) => b.placements.includes(placement))
  const out: Listing[] = []
  for (const b of bookings) {
    const l = resolveListingForAdBooking(b)
    if (l) out.push(l)
  }
  return dedupeListingsById(out)
}

/** Spaja promovirane oglase ispred postojeće liste, bez duplikata po `id`. */
export function mergePromotedFirst(promoted: Listing[], base: Listing[], maxTotal?: number): Listing[] {
  const seen = new Set<string>()
  const out: Listing[] = []
  for (const l of promoted) {
    if (seen.has(l.id)) continue
    seen.add(l.id)
    out.push(l)
    if (maxTotal != null && out.length >= maxTotal) return out
  }
  for (const l of base) {
    if (seen.has(l.id)) continue
    seen.add(l.id)
    out.push(l)
    if (maxTotal != null && out.length >= maxTotal) break
  }
  return out
}
