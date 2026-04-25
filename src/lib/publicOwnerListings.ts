import type { OwnerListingRow } from '../utils/ownerSession'
import { getOwnerListings, replaceOwnerListingsForUser } from '../utils/ownerSession'
import type { AccommodationListingDraft } from '../utils/accommodationDraft'
import {
  ACCOMMODATION_DRAFT_LS_KEY,
  CAR_DRAFT_LS_KEY,
  MOTO_DRAFT_LS_KEY,
} from '../utils/accommodationDraft'

type PublicOwnerListing = OwnerListingRow & {
  publicListingId: string
  draft: AccommodationListingDraft
}

const CATEGORY_DRAFT_KEY = {
  accommodation: ACCOMMODATION_DRAFT_LS_KEY,
  car: CAR_DRAFT_LS_KEY,
  motorcycle: MOTO_DRAFT_LS_KEY,
} as const

function storeDraft(row: PublicOwnerListing): void {
  try {
    const baseKey = CATEGORY_DRAFT_KEY[row.category]
    localStorage.setItem(`${baseKey}::${row.id}`, JSON.stringify(row.draft))
  } catch {
    /* ignore */
  }
}

export async function pullPublicOwnerListingsToLocal(): Promise<boolean> {
  try {
    const r = await fetch('/api/public-owner-listings')
    if (!r.ok) return false
    const j = (await r.json()) as { ok?: boolean; listings?: PublicOwnerListing[] }
    if (!j.ok || !Array.isArray(j.listings)) return false

    const byOwner = new Map<string, OwnerListingRow[]>()
    for (const row of j.listings) {
      if (
        !row ||
        typeof row.id !== 'string' ||
        typeof row.userId !== 'string' ||
        (row.category !== 'accommodation' && row.category !== 'car' && row.category !== 'motorcycle') ||
        !row.publicListingId ||
        !row.draft
      ) {
        continue
      }
      storeDraft(row)
      const list = byOwner.get(row.userId) ?? []
      list.push({
        id: row.id,
        userId: row.userId,
        category: row.category,
        title: row.title,
        viewsMonth: row.viewsMonth,
        contactClicksMonth: row.contactClicksMonth,
        receivedAt: row.receivedAt,
        expiresAt: row.expiresAt,
        featuredUntil: row.featuredUntil,
        internalNote: row.internalNote,
        publicListingId: row.publicListingId,
      })
      byOwner.set(row.userId, list)
    }

    for (const [ownerUserId, rows] of byOwner) {
      const merged = new Map(getOwnerListings(ownerUserId).map((row) => [row.id, row]))
      for (const row of rows) {
        merged.set(row.id, row)
      }
      replaceOwnerListingsForUser(ownerUserId, Array.from(merged.values()))
    }

    try {
      window.dispatchEvent(new Event('rentadria-public-owner-listings-updated'))
    } catch {
      /* ignore */
    }
    return true
  } catch {
    return false
  }
}
