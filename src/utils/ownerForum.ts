import { maskProfanity } from './profanityFilter'

export type ForumReply = {
  id: string
  authorUserId: string
  authorName: string
  body: string
  createdAt: string
}

export type ForumTopic = {
  id: string
  title: string
  initialBody: string
  authorUserId: string
  authorName: string
  createdAt: string
  updatedAt?: string
  replies: ForumReply[]
}

export type ForumTopicListRow = Omit<ForumTopic, 'replies' | 'initialBody'> & {
  replyCount: number
}

let topicsCache: ForumTopicListRow[] | null = null
const threadCache = new Map<string, ForumTopic>()

const JSON_HDR: Record<string, string> = { 'content-type': 'application/json' }

function emitUpdated() {
  try {
    window.dispatchEvent(new Event('rentadria-owner-forum-updated'))
  } catch {
    /* ignore */
  }
}

function parseReply(r: unknown): ForumReply | null {
  if (!r || typeof r !== 'object') return null
  const rr = r as Record<string, unknown>
  const id = typeof rr.id === 'string' ? rr.id : ''
  if (!id) return null
  return {
    id,
    authorUserId: typeof rr.authorUserId === 'string' ? rr.authorUserId : '',
    authorName: typeof rr.authorName === 'string' ? rr.authorName : '',
    body: typeof rr.body === 'string' ? rr.body : '',
    createdAt: typeof rr.createdAt === 'string' ? rr.createdAt : new Date().toISOString(),
  }
}

function parseThread(t: unknown): ForumTopic | null {
  if (!t || typeof t !== 'object') return null
  const tt = t as Record<string, unknown>
  const id = typeof tt.id === 'string' ? tt.id : ''
  if (!id) return null
  const repliesRaw = Array.isArray(tt.replies) ? tt.replies : []
  const replies: ForumReply[] = []
  for (const r of repliesRaw) {
    const rr = parseReply(r)
    if (rr) replies.push(rr)
  }
  return {
    id,
    title: typeof tt.title === 'string' ? tt.title : '',
    initialBody: typeof tt.initialBody === 'string' ? tt.initialBody : '',
    authorUserId: typeof tt.authorUserId === 'string' ? tt.authorUserId : '',
    authorName: typeof tt.authorName === 'string' ? tt.authorName : '',
    createdAt: typeof tt.createdAt === 'string' ? tt.createdAt : new Date().toISOString(),
    updatedAt: typeof tt.updatedAt === 'string' ? tt.updatedAt : undefined,
    replies,
  }
}

function parseTopicsList(a: unknown): ForumTopicListRow[] | null {
  if (!Array.isArray(a)) return null
  const out: ForumTopicListRow[] = []
  for (const r of a) {
    if (!r || typeof r !== 'object') continue
    const rr = r as Record<string, unknown>
    const id = typeof rr.id === 'string' ? rr.id : ''
    if (!id) continue
    out.push({
      id,
      title: typeof rr.title === 'string' ? rr.title : '',
      authorUserId: typeof rr.authorUserId === 'string' ? rr.authorUserId : '',
      authorName: typeof rr.authorName === 'string' ? rr.authorName : '',
      createdAt: typeof rr.createdAt === 'string' ? rr.createdAt : new Date().toISOString(),
      updatedAt: typeof rr.updatedAt === 'string' ? rr.updatedAt : undefined,
      replyCount: typeof rr.replyCount === 'number' ? Math.max(0, rr.replyCount) : 0,
    })
  }
  return out
}

export function listTopics(): ForumTopicListRow[] {
  return topicsCache ?? []
}

export function getTopic(id: string): ForumTopic | undefined {
  return threadCache.get(id)
}

export async function pullTopics(): Promise<ForumTopicListRow[] | null> {
  try {
    const r = await fetch('/api/owner-forum-topics', { credentials: 'include' })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; topics?: unknown }
    if (!r.ok || !j.ok) return null
    const parsed = parseTopicsList(j.topics)
    if (!parsed) return null
    topicsCache = parsed
    emitUpdated()
    return parsed
  } catch {
    return null
  }
}

export async function pullThread(topicId: string): Promise<ForumTopic | null> {
  try {
    const r = await fetch(`/api/owner-forum-thread?id=${encodeURIComponent(topicId)}`, { credentials: 'include' })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; topic?: unknown }
    if (!r.ok || !j.ok) return null
    const parsed = parseThread(j.topic)
    if (!parsed) return null
    threadCache.set(topicId, parsed)
    emitUpdated()
    return parsed
  } catch {
    return null
  }
}

export async function createTopic(opts: {
  authorUserId: string
  authorName: string
  title: string
  initialBody: string
}): Promise<{ ok: true; topicId: string } | { ok: false }> {
  const title = maskProfanity(opts.title.trim())
  const body = maskProfanity(opts.initialBody.trim())
  if (!title || !body) return { ok: false }
  try {
    const r = await fetch('/api/owner-forum-topics', {
      method: 'POST',
      headers: JSON_HDR,
      credentials: 'include',
      body: JSON.stringify({ title, body, authorName: opts.authorName }),
    })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; topicId?: string }
    if (!r.ok || !j.ok || typeof j.topicId !== 'string' || !j.topicId) return { ok: false }
    await pullTopics()
    await pullThread(j.topicId)
    return { ok: true, topicId: j.topicId }
  } catch {
    return { ok: false }
  }
}

export async function addReply(opts: {
  topicId: string
  authorUserId: string
  authorName: string
  body: string
}): Promise<{ ok: true } | { ok: false }> {
  const body = maskProfanity(opts.body.trim())
  if (!body) return { ok: false }
  try {
    const r = await fetch(`/api/owner-forum-thread?id=${encodeURIComponent(opts.topicId)}`, {
      method: 'POST',
      headers: JSON_HDR,
      credentials: 'include',
      body: JSON.stringify({ body, authorName: opts.authorName }),
    })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean }
    if (!r.ok || !j.ok) return { ok: false }
    await Promise.all([pullTopics(), pullThread(opts.topicId)])
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
