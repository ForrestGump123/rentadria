import { maskProfanity } from './profanityFilter'

const STORAGE_KEY = 'rentadria_owner_forum_v1'

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
  replies: ForumReply[]
}

function load(): ForumTopic[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const a = JSON.parse(raw) as unknown
    return Array.isArray(a) ? (a as ForumTopic[]) : []
  } catch {
    return []
  }
}

function save(rows: ForumTopic[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
  try {
    window.dispatchEvent(new Event('rentadria-owner-forum-updated'))
  } catch {
    /* ignore */
  }
}

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function listTopics(): ForumTopic[] {
  return load().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function getTopic(id: string): ForumTopic | undefined {
  return load().find((t) => t.id === id)
}

export function createTopic(opts: {
  authorUserId: string
  authorName: string
  title: string
  initialBody: string
}): ForumTopic | null {
  const title = maskProfanity(opts.title.trim())
  const initialBody = maskProfanity(opts.initialBody.trim())
  if (!title || !initialBody) return null
  const row: ForumTopic = {
    id: newId(),
    title,
    initialBody,
    authorUserId: opts.authorUserId,
    authorName: opts.authorName.trim() || '—',
    createdAt: new Date().toISOString(),
    replies: [],
  }
  const all = load()
  all.unshift(row)
  save(all)
  return row
}

export function addReply(opts: {
  topicId: string
  authorUserId: string
  authorName: string
  body: string
}): ForumReply | null {
  const body = maskProfanity(opts.body.trim())
  if (!body) return null
  const all = load()
  const i = all.findIndex((t) => t.id === opts.topicId)
  if (i < 0) return null
  const reply: ForumReply = {
    id: newId(),
    authorUserId: opts.authorUserId,
    authorName: opts.authorName.trim() || '—',
    body,
    createdAt: new Date().toISOString(),
  }
  const t = all[i]!
  all[i] = { ...t, replies: [...t.replies, reply] }
  save(all)
  return reply
}
