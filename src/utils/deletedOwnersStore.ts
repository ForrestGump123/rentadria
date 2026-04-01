import type { AdminOwnerMeta } from './adminOwnerMeta'
import type { OwnerListingRow, OwnerProfile } from './ownerSession' // type-only: no runtime cycle

const KEY = 'rentadria_deleted_owners_v1'
/** Nakon 30 dana zapis se automatski briše (bez restore). */
const RETENTION_MS = 30 * 86_400_000

export type DeletedOwnerRecord = {
  userId: string
  deletedAt: string
  profile: OwnerProfile
  listings: OwnerListingRow[]
  meta: AdminOwnerMeta
}

function load(): DeletedOwnerRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const a = JSON.parse(raw) as DeletedOwnerRecord[]
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}

function save(rows: DeletedOwnerRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(rows))
}

function purgeOlderThan30Days(): void {
  const now = Date.now()
  const prev = load()
  const rows = prev.filter((r) => now - new Date(r.deletedAt).getTime() <= RETENTION_MS)
  if (rows.length !== prev.length) save(rows)
}

export function listDeletedOwners(): DeletedOwnerRecord[] {
  purgeOlderThan30Days()
  return load().slice().sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
}

export function getDeletedOwner(userId: string): DeletedOwnerRecord | undefined {
  return load().find((x) => x.userId === userId)
}

export function isOwnerDeleted(userId: string): boolean {
  return load().some((x) => x.userId === userId)
}

export function isEmailInDeletedOwners(email: string): boolean {
  const em = email.trim().toLowerCase()
  return load().some((x) => x.profile.email.trim().toLowerCase() === em)
}

export function pushDeletedOwner(rec: DeletedOwnerRecord): void {
  const rows = load().filter((x) => x.userId !== rec.userId)
  rows.push(rec)
  save(rows)
}

export function removeDeletedOwner(userId: string): void {
  save(load().filter((x) => x.userId !== userId))
}
