import { getSupabaseAdmin } from './supabaseAdmin.js'

const TABLE = 'rentadria_registered_owners'

export type DeletedOwnerItem = {
  userId: string
  email: string
  displayName: string
  deletedAt: string
}

function rowToItem(r: Record<string, unknown>): DeletedOwnerItem | null {
  const userId = typeof r.user_id === 'string' ? r.user_id.trim().toLowerCase() : ''
  if (!userId) return null
  const deletedAt = typeof r.deleted_at === 'string' ? r.deleted_at : ''
  if (!deletedAt) return null
  const d = new Date(deletedAt)
  if (Number.isNaN(d.getTime())) return null
  const email = typeof r.email === 'string' && r.email.trim() ? r.email.trim().toLowerCase() : userId
  const displayName =
    typeof r.display_name === 'string' && r.display_name.trim() ? r.display_name.trim() : userId.split('@')[0] || userId
  return { userId, email, displayName, deletedAt: d.toISOString() }
}

export async function listDeletedOwners(): Promise<DeletedOwnerItem[] | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const { data, error } = await sb
    .from(TABLE)
    .select('user_id, email, display_name, deleted_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(1000)
  if (error || !Array.isArray(data)) return null
  const out: DeletedOwnerItem[] = []
  for (const raw of data) {
    const m = rowToItem(raw as Record<string, unknown>)
    if (m) out.push(m)
  }
  return out
}

export async function softDeleteOwner(userId: string): Promise<boolean> {
  const sb = getSupabaseAdmin()
  if (!sb) return false
  const uid = userId.trim().toLowerCase()
  if (!uid) return false
  const { error } = await sb.from(TABLE).update({ deleted_at: new Date().toISOString() }).eq('user_id', uid)
  return !error
}

export async function restoreDeletedOwner(userId: string): Promise<boolean> {
  const sb = getSupabaseAdmin()
  if (!sb) return false
  const uid = userId.trim().toLowerCase()
  if (!uid) return false
  const { error } = await sb.from(TABLE).update({ deleted_at: null }).eq('user_id', uid)
  return !error
}

/**
 * Permanently purge owners soft-deleted before the cutoff.
 * Best-effort cleanup across related Supabase tables (no anon policies; service role).
 */
export async function purgeDeletedOwnersOlderThan(days: number): Promise<{ scanned: number; purged: number }> {
  const sb = getSupabaseAdmin()
  if (!sb) return { scanned: 0, purged: 0 }
  const d = Math.max(1, Math.min(3650, Math.floor(days)))
  const cutoff = new Date(Date.now() - d * 86_400_000).toISOString()

  const { data, error } = await sb
    .from(TABLE)
    .select('user_id, deleted_at')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff)
    .limit(5000)

  if (error || !Array.isArray(data)) return { scanned: 0, purged: 0 }

  const userIds = (data as Array<{ user_id?: unknown }>).map((r) => (typeof r.user_id === 'string' ? r.user_id.trim().toLowerCase() : '')).filter((x) => x.length > 0)
  const scanned = userIds.length
  if (userIds.length === 0) return { scanned, purged: 0 }

  // Related tables cleanup (ignore errors so one failure doesn't block the purge).
  const safeDel = async (table: string, col: string) => {
    try {
      await sb.from(table).delete().in(col, userIds)
    } catch {
      /* ignore */
    }
  }

  await safeDel('rentadria_owner_listings', 'user_id')
  await safeDel('rentadria_owner_inquiry_unread', 'owner_user_id')
  await safeDel('rentadria_visitor_inquiries', 'owner_user_id')
  await safeDel('rentadria_owner_notifications', 'user_id')
  await safeDel('rentadria_promo_redemptions', 'user_id')
  await safeDel('rentadria_listing_metrics_monthly', 'owner_user_id')
  await safeDel('rentadria_import_owner_settings', 'owner_user_id')
  await safeDel('rentadria_listing_drafts', 'owner_user_id')
  await safeDel('rentadria_listing_gallery_admin', 'owner_user_id')
  await safeDel('rentadria_owner_admin_threads', 'owner_user_id')

  // Finally, remove the owner rows themselves.
  const { error: delErr } = await sb.from(TABLE).delete().in('user_id', userIds)
  return { scanned, purged: delErr ? 0 : userIds.length }
}

