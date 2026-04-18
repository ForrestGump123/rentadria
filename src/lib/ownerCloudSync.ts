import type { OwnerListingRow } from '../utils/ownerSession'
import { replaceOwnerListingsForUser } from '../utils/ownerSession'

const JSON_HDR = { 'Content-Type': 'application/json' } as const

/** Razmjena kratkog JWT-a nakon verify-email u HttpOnly owner sesiju. */
export async function exchangeOwnerSessionAfterVerify(token: string): Promise<boolean> {
  try {
    const r = await fetch('/api/owner-session-exchange', {
      method: 'POST',
      credentials: 'include',
      headers: JSON_HDR,
      body: JSON.stringify({ token }),
    })
    return r.ok
  } catch {
    return false
  }
}

/** Učitaj oglase vlasnika sa servera u localStorage (izvor istine kad postoji sesija). */
export async function pullOwnerListingsFromCloud(userId: string): Promise<boolean> {
  try {
    const r = await fetch('/api/owner-listings', { credentials: 'include' })
    const j = (await r.json()) as { ok?: boolean; listings?: OwnerListingRow[] }
    if (!r.ok || !j.ok || !Array.isArray(j.listings)) return false
    replaceOwnerListingsForUser(userId, j.listings)
    return true
  } catch {
    return false
  }
}

export async function pushOwnerListingToCloud(row: OwnerListingRow): Promise<boolean> {
  try {
    const r = await fetch('/api/owner-listings', {
      method: 'POST',
      credentials: 'include',
      headers: JSON_HDR,
      body: JSON.stringify({ listing: row }),
    })
    return r.ok
  } catch {
    return false
  }
}

export async function deleteOwnerListingFromCloud(_userId: string, rowId: string): Promise<boolean> {
  try {
    const q = new URLSearchParams({ id: rowId })
    const r = await fetch(`/api/owner-listings?${q}`, { method: 'DELETE', credentials: 'include' })
    return r.ok
  } catch {
    return false
  }
}
