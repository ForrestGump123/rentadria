import type { AdminPromoCodeRecord } from '../utils/adminPromoCodes'
import type { OwnerProfile } from '../utils/ownerSession'
import { fetchAdminOwnersProfiles } from './adminOwnersApi'

export type AdminOwnerPickRow = Pick<OwnerProfile, 'userId' | 'displayName' | 'email' | 'phone'>

/** Članovi za ograničenje koda (Supabase, isti endpoint kao Vlasnici). */
export async function fetchAdminOwnerPickList(): Promise<AdminOwnerPickRow[] | null> {
  const owners = await fetchAdminOwnersProfiles()
  if (owners === null) return null
  return owners.map((o) => ({
    userId: o.userId,
    displayName: o.displayName,
    email: o.email,
    phone: o.phone,
  }))
}

/** Lista kodova iz Supabase (admin cookie). */
export async function fetchAdminPromoList(): Promise<AdminPromoCodeRecord[] | null> {
  try {
    const r = await fetch('/api/admin-promo', { credentials: 'include' })
    if (r.status === 503) return null
    if (!r.ok) return null
    const j = (await r.json()) as { ok?: boolean; records?: AdminPromoCodeRecord[] }
    if (!j.ok || !Array.isArray(j.records)) return null
    return j.records
  } catch {
    return null
  }
}

export async function upsertAdminPromoToServer(record: AdminPromoCodeRecord): Promise<boolean> {
  try {
    const r = await fetch('/api/admin-promo', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record }),
    })
    return r.ok
  } catch {
    return false
  }
}

export async function deleteAdminPromoOnServer(id: string): Promise<boolean> {
  try {
    const r = await fetch(`/api/admin-promo?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    return r.ok
  } catch {
    return false
  }
}
