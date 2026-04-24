export type AdminOwnerListingIndexRow = {
  rowId: string
  ownerUserId: string
  category: 'accommodation' | 'car' | 'motorcycle'
  title: string
  publicListingId: string | null
  createdAt: string
  countryId: string | null
  ownerDisplayName: string
}

export async function fetchAdminOwnerListingsIndex(): Promise<AdminOwnerListingIndexRow[] | null> {
  try {
    const r = await fetch('/api/admin-listings', { credentials: 'include' })
    if (r.status === 503) return null
    if (!r.ok) return null
    const j = (await r.json()) as { ok?: boolean; rows?: AdminOwnerListingIndexRow[] }
    if (!j.ok || !Array.isArray(j.rows)) return null
    return j.rows
  } catch {
    return null
  }
}

export async function adminDeleteOwnerListingOnServer(ownerUserId: string, rowId: string): Promise<boolean> {
  try {
    const r = await fetch('/api/admin-listings', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', ownerUserId, rowId }),
    })
    return r.ok
  } catch {
    return false
  }
}

