import type { AccommodationListingDraft } from '../utils/accommodationDraft'

export type ListingDraftCategory = 'accommodation' | 'car' | 'motorcycle'

export async function fetchDraft(opts: {
  asAdmin: boolean
  ownerUserId: string
  rowId: string
  category: ListingDraftCategory
}): Promise<AccommodationListingDraft | null> {
  const qs = new URLSearchParams({
    ownerUserId: opts.ownerUserId,
    rowId: opts.rowId,
    category: opts.category,
  })
  const url = opts.asAdmin ? `/api/admin-listing-draft?${qs.toString()}` : `/api/owner-listing-draft?${new URLSearchParams({ rowId: opts.rowId, category: opts.category }).toString()}`
  try {
    const r = await fetch(url, { credentials: 'include' })
    if (!r.ok) return null
    const j = (await r.json()) as { ok?: boolean; draft?: unknown }
    if (!j.ok) return null
    if (!j.draft || typeof j.draft !== 'object') return null
    return j.draft as AccommodationListingDraft
  } catch {
    return null
  }
}

export async function saveDraft(opts: {
  asAdmin: boolean
  ownerUserId: string
  rowId: string
  category: ListingDraftCategory
  draft: AccommodationListingDraft
}): Promise<boolean> {
  const url = opts.asAdmin ? '/api/admin-listing-draft' : '/api/owner-listing-draft'
  const body = opts.asAdmin
    ? { ownerUserId: opts.ownerUserId, rowId: opts.rowId, category: opts.category, draft: opts.draft }
    : { rowId: opts.rowId, category: opts.category, draft: opts.draft }
  try {
    const r = await fetch(url, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return r.ok
  } catch {
    return false
  }
}

