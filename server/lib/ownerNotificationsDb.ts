import { getSupabaseAdmin } from './supabaseAdmin.js'

const TABLE = 'rentadria_owner_notifications'

export type OwnerNotification = {
  id: string
  userId: string
  kind: string
  title: string
  body: string
  createdAt: string
  readAt: string | null
}

function rowToNotification(r: Record<string, unknown>): OwnerNotification | null {
  const id = typeof r.id === 'string' ? r.id : ''
  const userId = typeof r.user_id === 'string' ? r.user_id.trim().toLowerCase() : ''
  if (!id || !userId) return null
  const createdAt =
    typeof r.created_at === 'string' && r.created_at.trim()
      ? new Date(r.created_at).toISOString()
      : new Date().toISOString()
  const readAt =
    typeof r.read_at === 'string' && r.read_at.trim()
      ? new Date(r.read_at).toISOString()
      : null
  return {
    id,
    userId,
    kind: typeof r.kind === 'string' && r.kind.trim() ? r.kind.trim() : 'system',
    title: typeof r.title === 'string' ? r.title : '',
    body: typeof r.body === 'string' ? r.body : '',
    createdAt,
    readAt,
  }
}

export async function createOwnerNotification(opts: {
  userId: string
  kind?: string
  title: string
  body: string
  refValidUntilIso?: string | null
  daysBefore?: number | null
}): Promise<boolean> {
  const sb = getSupabaseAdmin()
  if (!sb) return false
  const uid = opts.userId.trim().toLowerCase()
  if (!uid) return false
  const refValidUntil =
    typeof opts.refValidUntilIso === 'string' && opts.refValidUntilIso.trim()
      ? opts.refValidUntilIso.trim()
      : null
  const daysBefore =
    typeof opts.daysBefore === 'number' && Number.isFinite(opts.daysBefore) ? Math.trunc(opts.daysBefore) : null
  const row = {
    user_id: uid,
    kind: (opts.kind ?? 'system').trim() || 'system',
    title: opts.title.trim(),
    body: opts.body.trim(),
    ref_valid_until: refValidUntil,
    days_before: daysBefore,
    created_at: new Date().toISOString(),
  }
  const { error } = await sb.from(TABLE).insert(row)
  // Unique reminder index: treat duplicates as success (already sent).
  if (error && String((error as { code?: string }).code ?? '') === '23505') return true
  return !error
}

export async function listOwnerNotifications(userId: string, limit = 50): Promise<OwnerNotification[] | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const uid = userId.trim().toLowerCase()
  const { data, error } = await sb
    .from(TABLE)
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(200, limit)))
  if (error || !Array.isArray(data)) return null
  const out: OwnerNotification[] = []
  for (const raw of data) {
    const m = rowToNotification(raw as Record<string, unknown>)
    if (m) out.push(m)
  }
  return out
}

export async function markOwnerNotificationRead(userId: string, id: string): Promise<boolean> {
  const sb = getSupabaseAdmin()
  if (!sb) return false
  const uid = userId.trim().toLowerCase()
  const nid = id.trim()
  if (!uid || !nid) return false
  const { error } = await sb
    .from(TABLE)
    .update({ read_at: new Date().toISOString() })
    .eq('id', nid)
    .eq('user_id', uid)
  return !error
}

