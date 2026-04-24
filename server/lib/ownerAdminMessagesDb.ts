import { getSupabaseAdmin } from './supabaseAdmin.js'

const T_THREADS = 'rentadria_owner_admin_threads'
const T_MSG = 'rentadria_owner_admin_messages'

export type MessageParty = 'owner' | 'admin'

export type ThreadListItem = {
  id: string
  ownerUserId: string
  ownerEmail?: string
  subject: string
  lastMessage: string
  lastFrom: MessageParty
  messageCount: number
  createdAt: string
  updatedAt: string
  unreadForOwner: boolean
  unreadForAdmin: boolean
}

export type ThreadMessage = {
  id: string
  from: MessageParty
  body: string
  at: string
}

function parseIso(v: unknown): string {
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return new Date().toISOString()
}

function partyOk(v: unknown): v is MessageParty {
  return v === 'owner' || v === 'admin'
}

function rowToThread(r: Record<string, unknown>): ThreadListItem | null {
  const id = typeof r.id === 'string' ? r.id : ''
  const ownerUserId = typeof r.owner_user_id === 'string' ? r.owner_user_id.trim().toLowerCase() : ''
  if (!id || !ownerUserId) return null
  const subject = typeof r.subject === 'string' ? r.subject : ''
  const lastMessage = typeof r.last_message === 'string' ? r.last_message : ''
  const lastFrom = partyOk(r.last_from) ? (r.last_from as MessageParty) : 'owner'
  const messageCount = Math.max(0, Number(r.message_count) || 0)
  const ownerEmail = typeof r.owner_email === 'string' && r.owner_email.trim() ? r.owner_email.trim() : undefined
  const createdAt = parseIso(r.created_at)
  const updatedAt = parseIso(r.updated_at)
  const ownerSeen = r.owner_last_seen_at ? parseIso(r.owner_last_seen_at) : null
  const adminSeen = r.admin_last_seen_at ? parseIso(r.admin_last_seen_at) : null
  const unreadForOwner = lastFrom === 'admin' && (!ownerSeen || ownerSeen < updatedAt)
  const unreadForAdmin = lastFrom === 'owner' && (!adminSeen || adminSeen < updatedAt)
  return {
    id,
    ownerUserId,
    ownerEmail,
    subject,
    lastMessage,
    lastFrom,
    messageCount,
    createdAt,
    updatedAt,
    unreadForOwner,
    unreadForAdmin,
  }
}

function rowToMessage(r: Record<string, unknown>): ThreadMessage | null {
  const id = typeof r.id === 'string' ? r.id : ''
  const from = partyOk(r.from_party) ? (r.from_party as MessageParty) : null
  if (!id || !from) return null
  return {
    id,
    from,
    body: typeof r.body === 'string' ? r.body : '',
    at: parseIso(r.created_at),
  }
}

export async function listThreadsForOwner(ownerUserId: string): Promise<ThreadListItem[] | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const uid = ownerUserId.trim().toLowerCase()
  const { data, error } = await sb.from(T_THREADS).select('*').eq('owner_user_id', uid).order('updated_at', { ascending: false }).limit(500)
  if (error || !Array.isArray(data)) return null
  const out: ThreadListItem[] = []
  for (const raw of data) {
    const m = rowToThread(raw as Record<string, unknown>)
    if (m) out.push(m)
  }
  return out
}

export async function listThreadsForAdmin(): Promise<ThreadListItem[] | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const { data, error } = await sb.from(T_THREADS).select('*').order('updated_at', { ascending: false }).limit(1000)
  if (error || !Array.isArray(data)) return null
  const out: ThreadListItem[] = []
  for (const raw of data) {
    const m = rowToThread(raw as Record<string, unknown>)
    if (m) out.push(m)
  }
  return out
}

export async function getThreadMessages(threadId: string): Promise<ThreadMessage[] | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const tid = threadId.trim()
  const { data, error } = await sb.from(T_MSG).select('*').eq('thread_id', tid).order('created_at', { ascending: true }).limit(2000)
  if (error || !Array.isArray(data)) return null
  const out: ThreadMessage[] = []
  for (const raw of data) {
    const m = rowToMessage(raw as Record<string, unknown>)
    if (m) out.push(m)
  }
  return out
}

export async function createThread(opts: { ownerUserId: string; ownerEmail?: string; subject: string; body: string }): Promise<{ ok: boolean; threadId?: string; error?: string }> {
  const sb = getSupabaseAdmin()
  if (!sb) return { ok: false, error: 'no_backend' }
  const uid = opts.ownerUserId.trim().toLowerCase()
  const subject = opts.subject.trim().slice(0, 200)
  const body = opts.body.trim().slice(0, 8000)
  if (!uid || !subject || !body) return { ok: false, error: 'missing' }
  const now = new Date().toISOString()

  const { data: thread, error: thErr } = await sb
    .from(T_THREADS)
    .insert({
      owner_user_id: uid,
      owner_email: opts.ownerEmail?.trim() || null,
      subject,
      last_message: body.slice(0, 240),
      last_from: 'owner',
      message_count: 1,
      updated_at: now,
      created_at: now,
    })
    .select('id')
    .maybeSingle()

  if (thErr || !thread) return { ok: false, error: thErr?.message ?? 'create_failed' }
  const tid = (thread as { id?: unknown }).id
  if (typeof tid !== 'string') return { ok: false, error: 'create_failed' }

  const { error: msgErr } = await sb.from(T_MSG).insert({
    thread_id: tid,
    from_party: 'owner',
    body,
    created_at: now,
  })
  if (msgErr) return { ok: false, error: msgErr.message }

  return { ok: true, threadId: tid }
}

export async function appendMessage(opts: { threadId: string; from: MessageParty; body: string }): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseAdmin()
  if (!sb) return { ok: false, error: 'no_backend' }
  const tid = opts.threadId.trim()
  const body = opts.body.trim().slice(0, 8000)
  if (!tid || !body) return { ok: false, error: 'missing' }
  const { data, error } = await sb.rpc('ra_append_owner_admin_message', {
    p_thread_id: tid,
    p_from: opts.from,
    p_body: body,
  })
  if (error) return { ok: false, error: error.message }
  if (data !== true) return { ok: false, error: 'append_failed' }
  return { ok: true }
}

export async function markThreadSeen(opts: { threadId: string; party: MessageParty }): Promise<boolean> {
  const sb = getSupabaseAdmin()
  if (!sb) return false
  const tid = opts.threadId.trim()
  if (!tid) return false
  const now = new Date().toISOString()
  const patch =
    opts.party === 'owner'
      ? { owner_last_seen_at: now }
      : { admin_last_seen_at: now }
  const { error } = await sb.from(T_THREADS).update(patch).eq('id', tid)
  return !error
}

