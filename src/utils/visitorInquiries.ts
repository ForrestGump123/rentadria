import type { OwnerListingRow } from './ownerSession'

/** Must match `ownerSession` — avoid importing that module here (circular with notify seed). */
const OWNER_LISTINGS_MAP_KEY = 'rentadria_owner_listings_by_user'

const NOTIFY_EMAIL_KEY = 'rentadria_listing_inquiry_notify_email_v1'
const INQUIRIES_BY_OWNER_KEY = 'rentadria_inquiries_by_owner_v1'
const INQUIRY_UNREAD_KEY = 'rentadria_owner_inquiry_unread_v1'
const ADMIN_VISITOR_INQ_UNREAD_KEY = 'rentadria_admin_visitor_inquiry_unread_v1'

function getAllOwnerListingRowsFlat(): OwnerListingRow[] {
  try {
    const raw = localStorage.getItem(OWNER_LISTINGS_MAP_KEY)
    if (!raw) return []
    const m = JSON.parse(raw) as Record<string, OwnerListingRow[]>
    return Object.values(m).flat()
  } catch {
    return []
  }
}

export type VisitorInquiryRecord = {
  id: string
  at: string
  listingId: string
  listingTitle: string
  first: string
  last: string
  email: string
  phone: string
  period: string
  guests: string
  message: string
  /** Admin: pauza dopisivanja za ovaj upit */
  paused?: boolean
  /** Odgovor vlasnika (admin može uređivati) */
  ownerReply?: string
}

function loadNotifyMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(NOTIFY_EMAIL_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== 'object') return {}
    return o as Record<string, string>
  } catch {
    return {}
  }
}

export function setListingInquiryNotifyEmail(listingId: string, email: string): void {
  const e = email.trim()
  if (!e) return
  const m = loadNotifyMap()
  m[listingId] = e
  localStorage.setItem(NOTIFY_EMAIL_KEY, JSON.stringify(m))
}

export function getListingInquiryNotifyEmail(listingId: string): string | null {
  const m = loadNotifyMap()
  const v = m[listingId]?.trim()
  return v || null
}

function loadInquiriesMap(): Record<string, VisitorInquiryRecord[]> {
  try {
    const raw = localStorage.getItem(INQUIRIES_BY_OWNER_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== 'object') return {}
    return o as Record<string, VisitorInquiryRecord[]>
  } catch {
    return {}
  }
}

function saveInquiriesMap(m: Record<string, VisitorInquiryRecord[]>) {
  localStorage.setItem(INQUIRIES_BY_OWNER_KEY, JSON.stringify(m))
}

export function resolveOwnerUserIdForListing(listingId: string): string | null {
  const row = getAllOwnerListingRowsFlat().find((r) => r.publicListingId === listingId)
  return row?.userId ?? null
}

export function appendVisitorInquiry(ownerUserId: string, row: Omit<VisitorInquiryRecord, 'id' | 'at'>): void {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const full: VisitorInquiryRecord = {
    ...row,
    id,
    at: new Date().toISOString(),
  }
  const m = loadInquiriesMap()
  const arr = m[ownerUserId] ?? []
  arr.unshift(full)
  m[ownerUserId] = arr
  saveInquiriesMap(m)
  bumpAdminVisitorInquiryUnread()
  dispatchInquiriesUpdated()
}

export function getAllVisitorInquiriesForAdmin(): (VisitorInquiryRecord & { ownerUserId: string })[] {
  const m = loadInquiriesMap()
  const out: (VisitorInquiryRecord & { ownerUserId: string })[] = []
  for (const [ownerUserId, arr] of Object.entries(m)) {
    for (const r of arr) {
      out.push({ ...r, ownerUserId })
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at))
}

export function updateVisitorInquiry(
  ownerUserId: string,
  inquiryId: string,
  patch: Partial<Pick<VisitorInquiryRecord, 'message' | 'ownerReply' | 'paused'>>,
): boolean {
  const m = loadInquiriesMap()
  const arr = m[ownerUserId]
  if (!arr) return false
  const i = arr.findIndex((x) => x.id === inquiryId)
  if (i < 0) return false
  arr[i] = { ...arr[i]!, ...patch }
  m[ownerUserId] = arr
  saveInquiriesMap(m)
  dispatchInquiriesUpdated()
  return true
}

export function deleteVisitorInquiry(ownerUserId: string, inquiryId: string): boolean {
  const m = loadInquiriesMap()
  const arr = m[ownerUserId]
  if (!arr) return false
  const next = arr.filter((x) => x.id !== inquiryId)
  if (next.length === arr.length) return false
  m[ownerUserId] = next
  saveInquiriesMap(m)
  dispatchInquiriesUpdated()
  return true
}

export function getInquiriesForOwner(userId: string): VisitorInquiryRecord[] {
  return loadInquiriesMap()[userId] ?? []
}

export function countInquiriesThisMonth(userId: string): number {
  const now = new Date()
  const y = now.getFullYear()
  const mo = now.getMonth()
  return getInquiriesForOwner(userId).filter((i) => {
    const d = new Date(i.at)
    return !Number.isNaN(d.getTime()) && d.getFullYear() === y && d.getMonth() === mo
  }).length
}

export function dispatchInquiriesUpdated() {
  try {
    window.dispatchEvent(new Event('rentadria-inquiries-updated'))
  } catch {
    /* ignore */
  }
}

export function bumpAdminVisitorInquiryUnread(): void {
  try {
    const n = Math.max(0, Number(localStorage.getItem(ADMIN_VISITOR_INQ_UNREAD_KEY) || '0')) + 1
    localStorage.setItem(ADMIN_VISITOR_INQ_UNREAD_KEY, String(n))
    window.dispatchEvent(new Event('rentadria-admin-visitor-inquiries-updated'))
  } catch {
    /* ignore */
  }
}

export function getAdminVisitorInquiryUnreadCount(): number {
  try {
    return Math.max(0, Number(localStorage.getItem(ADMIN_VISITOR_INQ_UNREAD_KEY) || '0'))
  } catch {
    return 0
  }
}

export function clearAdminVisitorInquiryUnread(): void {
  try {
    localStorage.removeItem(ADMIN_VISITOR_INQ_UNREAD_KEY)
    window.dispatchEvent(new Event('rentadria-admin-visitor-inquiries-updated'))
  } catch {
    /* ignore */
  }
}

function loadUnreadMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(INQUIRY_UNREAD_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== 'object') return {}
    return o as Record<string, number>
  } catch {
    return {}
  }
}

function saveUnreadMap(m: Record<string, number>) {
  localStorage.setItem(INQUIRY_UNREAD_KEY, JSON.stringify(m))
}

export function getInquiryUnreadCount(ownerUserId: string): number {
  const n = loadUnreadMap()[ownerUserId]
  return typeof n === 'number' && n > 0 ? n : 0
}

export function bumpInquiryUnread(ownerUserId: string): void {
  const m = loadUnreadMap()
  m[ownerUserId] = (m[ownerUserId] ?? 0) + 1
  saveUnreadMap(m)
  try {
    window.dispatchEvent(new CustomEvent('rentadria-inquiry-dashboard-notify', { detail: { ownerUserId } }))
    window.dispatchEvent(new Event('rentadria-inquiry-unread-changed'))
  } catch {
    /* ignore */
  }
}

export function clearInquiryUnread(ownerUserId: string): void {
  const m = loadUnreadMap()
  if (m[ownerUserId]) {
    delete m[ownerUserId]
    saveUnreadMap(m)
  }
  try {
    window.dispatchEvent(new Event('rentadria-inquiry-unread-changed'))
  } catch {
    /* ignore */
  }
}
