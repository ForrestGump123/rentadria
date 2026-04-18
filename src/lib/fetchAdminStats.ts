export type AdminStatsPayload = {
  ok?: boolean
  /** Broj redova u Supabase `rentadria_registered_owners`; `null` ako brojanje nije uspjelo. */
  ownersRegistered?: number | null
  ownerListings?: number | null
  reviewBuckets?: number | null
  reportsSubmitted?: number | null
}

export async function fetchAdminDashboardStats(): Promise<AdminStatsPayload | null> {
  try {
    const r = await fetch('/api/admin-stats', { credentials: 'include' })
    const j = (await r.json()) as AdminStatsPayload
    if (!r.ok || !j.ok) return null
    return j
  } catch {
    return null
  }
}
