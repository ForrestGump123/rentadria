import { getSupabaseAdmin } from './supabaseAdmin.js'

const T_TOPICS = 'rentadria_owner_forum_topics'
const T_REPLIES = 'rentadria_owner_forum_replies'

export type ForumReplyRow = {
  id: string
  authorUserId: string
  authorName: string
  body: string
  createdAt: string
}

export type ForumTopicListRow = {
  id: string
  title: string
  authorUserId: string
  authorName: string
  createdAt: string
  updatedAt: string
  replyCount: number
}

export type ForumTopicFullRow = {
  id: string
  title: string
  initialBody: string
  authorUserId: string
  authorName: string
  createdAt: string
  updatedAt: string
  replies: ForumReplyRow[]
}

function iso(v: unknown): string {
  if (typeof v === 'string' && v.trim()) return new Date(v).toISOString()
  try {
    if (typeof v === 'number') return new Date(v).toISOString()
    if (v instanceof Date) return v.toISOString()
    if (typeof v === 'string') return new Date(v).toISOString()
    return new Date(String(v)).toISOString()
  } catch {
    return new Date().toISOString()
  }
}

function rowToTopicList(r: Record<string, unknown>, replyCount: number): ForumTopicListRow | null {
  const id = typeof r.id === 'string' ? r.id : ''
  if (!id) return null
  return {
    id,
    title: typeof r.title === 'string' ? r.title : '',
    authorUserId: typeof r.author_user_id === 'string' ? r.author_user_id : '',
    authorName: typeof r.author_name === 'string' ? r.author_name : '',
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at ?? r.created_at),
    replyCount: Math.max(0, replyCount || 0),
  }
}

function rowToTopicFull(topic: Record<string, unknown>, replies: ForumReplyRow[]): ForumTopicFullRow | null {
  const id = typeof topic.id === 'string' ? topic.id : ''
  if (!id) return null
  return {
    id,
    title: typeof topic.title === 'string' ? topic.title : '',
    initialBody: typeof topic.initial_body === 'string' ? topic.initial_body : '',
    authorUserId: typeof topic.author_user_id === 'string' ? topic.author_user_id : '',
    authorName: typeof topic.author_name === 'string' ? topic.author_name : '',
    createdAt: iso(topic.created_at),
    updatedAt: iso(topic.updated_at ?? topic.created_at),
    replies,
  }
}

function rowToReply(r: Record<string, unknown>): ForumReplyRow | null {
  const id = typeof r.id === 'string' ? r.id : ''
  if (!id) return null
  return {
    id,
    authorUserId: typeof r.author_user_id === 'string' ? r.author_user_id : '',
    authorName: typeof r.author_name === 'string' ? r.author_name : '',
    body: typeof r.body === 'string' ? r.body : '',
    createdAt: iso(r.created_at),
  }
}

export async function listForumTopics(limit = 200): Promise<ForumTopicListRow[] | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const lim = Math.max(1, Math.min(500, limit))

  const { data: topics, error } = await sb.from(T_TOPICS).select('*').order('updated_at', { ascending: false }).limit(lim)
  if (error || !Array.isArray(topics)) return null

  // Batch count replies for returned topics.
  const ids = (topics as unknown[]).map((t) => {
    if (!t || typeof t !== 'object') return ''
    const id = (t as Record<string, unknown>).id
    return typeof id === 'string' ? id : id == null ? '' : String(id)
  }).filter(Boolean)
  const counts = new Map<string, number>()
  if (ids.length) {
    const { data: rep } = await sb.from(T_REPLIES).select('topic_id').in('topic_id', ids).limit(50_000)
    if (Array.isArray(rep)) {
      for (const x of rep as unknown[]) {
        const tid =
          x && typeof x === 'object' && typeof (x as Record<string, unknown>).topic_id === 'string'
            ? String((x as Record<string, unknown>).topic_id)
            : ''
        if (!tid) continue
        counts.set(tid, (counts.get(tid) ?? 0) + 1)
      }
    }
  }

  const out: ForumTopicListRow[] = []
  for (const raw of topics as unknown as Record<string, unknown>[]) {
    const id = typeof raw.id === 'string' ? raw.id : ''
    const row = rowToTopicList(raw, counts.get(id) ?? 0)
    if (row) out.push(row)
  }
  return out
}

export async function getForumTopic(topicId: string): Promise<ForumTopicFullRow | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const id = topicId.trim()
  if (!id) return null

  const { data: topic, error: tErr } = await sb.from(T_TOPICS).select('*').eq('id', id).maybeSingle()
  if (tErr || !topic || typeof topic !== 'object') return null

  const { data: replies, error: rErr } = await sb.from(T_REPLIES).select('*').eq('topic_id', id).order('created_at', { ascending: true }).limit(5000)
  if (rErr || !Array.isArray(replies)) return null

  const outReplies: ForumReplyRow[] = []
  for (const raw of replies as unknown as Record<string, unknown>[]) {
    const m = rowToReply(raw)
    if (m) outReplies.push(m)
  }

  return rowToTopicFull(topic as unknown as Record<string, unknown>, outReplies)
}

export async function createForumTopic(input: {
  authorUserId: string
  authorName: string
  title: string
  initialBody: string
}): Promise<{ ok: true; topicId: string } | { ok: false; error: string }> {
  const sb = getSupabaseAdmin()
  if (!sb) return { ok: false, error: 'no_backend' }

  const authorUserId = input.authorUserId.trim().toLowerCase()
  const authorName = input.authorName.trim().slice(0, 120)
  const title = input.title.trim().slice(0, 180)
  const initialBody = input.initialBody.trim().slice(0, 8000)
  if (!authorUserId || !title || !initialBody) return { ok: false, error: 'missing_fields' }

  const row = {
    title,
    initial_body: initialBody,
    author_user_id: authorUserId,
    author_name: authorName || authorUserId.split('@')[0] || authorUserId,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await sb.from(T_TOPICS).insert(row).select('id').maybeSingle()
  if (error) return { ok: false, error: error.message }
  const id = (data as { id?: unknown } | null)?.id
  if (typeof id !== 'string' || !id) return { ok: false, error: 'insert_failed' }
  return { ok: true, topicId: id }
}

export async function addForumReply(input: {
  topicId: string
  authorUserId: string
  authorName: string
  body: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = getSupabaseAdmin()
  if (!sb) return { ok: false, error: 'no_backend' }

  const topicId = input.topicId.trim()
  const authorUserId = input.authorUserId.trim().toLowerCase()
  const authorName = input.authorName.trim().slice(0, 120)
  const body = input.body.trim().slice(0, 8000)
  if (!topicId || !authorUserId || !body) return { ok: false, error: 'missing_fields' }

  const { error } = await sb.from(T_REPLIES).insert({
    topic_id: topicId,
    author_user_id: authorUserId,
    author_name: authorName || authorUserId.split('@')[0] || authorUserId,
    body,
  })
  if (error) return { ok: false, error: error.message }

  // Bump updated_at on topic.
  await sb.from(T_TOPICS).update({ updated_at: new Date().toISOString() }).eq('id', topicId)
  return { ok: true }
}

