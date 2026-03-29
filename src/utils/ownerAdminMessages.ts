/** Vlasnik ↔ admin poruke (localStorage demo). */

const THREADS_KEY = 'rentadria_owner_admin_threads_v1'
const PRIVATE_NOTES_KEY = 'rentadria_owner_private_notes_v1'
const REMINDER_NOTES_KEY = 'rentadria_owner_reminder_notes_v1'

export type MessageParty = 'owner' | 'admin'

export type OwnerAdminMessage = {
  id: string
  from: MessageParty
  body: string
  at: string
}

export type OwnerAdminThread = {
  id: string
  ownerUserId: string
  /** Snimak emaila vlasnika za prikaz u admin panelu */
  ownerEmail?: string
  subject: string
  createdAt: string
  updatedAt: string
  messages: OwnerAdminMessage[]
}

export type PrivateOwnerNote = {
  id: string
  ownerUserId: string
  body: string
  at: string
}

export type ReminderOwnerNote = {
  id: string
  ownerUserId: string
  body: string
  remindAt: string
  createdAt: string
}

function loadThreads(): OwnerAdminThread[] {
  try {
    const raw = localStorage.getItem(THREADS_KEY)
    if (!raw) return []
    const a = JSON.parse(raw) as unknown
    return Array.isArray(a) ? (a as OwnerAdminThread[]) : []
  } catch {
    return []
  }
}

function saveThreads(rows: OwnerAdminThread[]) {
  localStorage.setItem(THREADS_KEY, JSON.stringify(rows))
  dispatchMessagesUpdated()
  try {
    window.dispatchEvent(new Event('rentadria-owner-messages-unread-changed'))
    window.dispatchEvent(new Event('rentadria-admin-messages-unread-changed'))
  } catch {
    /* ignore */
  }
}

function loadPrivateNotes(): PrivateOwnerNote[] {
  try {
    const raw = localStorage.getItem(PRIVATE_NOTES_KEY)
    if (!raw) return []
    const a = JSON.parse(raw) as unknown
    return Array.isArray(a) ? (a as PrivateOwnerNote[]) : []
  } catch {
    return []
  }
}

function savePrivateNotes(rows: PrivateOwnerNote[]) {
  localStorage.setItem(PRIVATE_NOTES_KEY, JSON.stringify(rows))
  dispatchMessagesUpdated()
}

function loadReminders(): ReminderOwnerNote[] {
  try {
    const raw = localStorage.getItem(REMINDER_NOTES_KEY)
    if (!raw) return []
    const a = JSON.parse(raw) as unknown
    return Array.isArray(a) ? (a as ReminderOwnerNote[]) : []
  } catch {
    return []
  }
}

function saveReminders(rows: ReminderOwnerNote[]) {
  localStorage.setItem(REMINDER_NOTES_KEY, JSON.stringify(rows))
  dispatchMessagesUpdated()
}

export function dispatchMessagesUpdated() {
  try {
    window.dispatchEvent(new Event('rentadria-owner-messages-updated'))
  } catch {
    /* ignore */
  }
}

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function listThreadsForOwner(ownerUserId: string): OwnerAdminThread[] {
  return loadThreads()
    .filter((t) => t.ownerUserId === ownerUserId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function listAllThreadsForAdmin(): OwnerAdminThread[] {
  return loadThreads().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function getThread(threadId: string): OwnerAdminThread | undefined {
  return loadThreads().find((t) => t.id === threadId)
}

export function createOwnerThread(opts: {
  ownerUserId: string
  ownerEmail?: string
  subject: string
  body: string
}): OwnerAdminThread {
  const subject = opts.subject.trim()
  const body = opts.body.trim()
  if (!subject || !body) throw new Error('missing')

  const now = new Date().toISOString()
  const msg: OwnerAdminMessage = {
    id: newId(),
    from: 'owner',
    body,
    at: now,
  }
  const thread: OwnerAdminThread = {
    id: newId(),
    ownerUserId: opts.ownerUserId,
    ownerEmail: opts.ownerEmail?.trim() || undefined,
    subject,
    createdAt: now,
    updatedAt: now,
    messages: [msg],
  }
  const all = loadThreads()
  all.unshift(thread)
  saveThreads(all)
  return thread
}

export function appendThreadMessage(opts: {
  threadId: string
  from: MessageParty
  body: string
  /** Za vlasnika — mora odgovarati vlasniku teme */
  actingOwnerUserId?: string
}): OwnerAdminThread | null {
  const body = opts.body.trim()
  if (!body) return null

  const all = loadThreads()
  const i = all.findIndex((t) => t.id === opts.threadId)
  if (i < 0) return null

  const t = all[i]!
  if (opts.from === 'owner') {
    if (!opts.actingOwnerUserId || t.ownerUserId !== opts.actingOwnerUserId) return null
  }

  const now = new Date().toISOString()
  const msg: OwnerAdminMessage = {
    id: newId(),
    from: opts.from,
    body,
    at: now,
  }
  const next: OwnerAdminThread = {
    ...t,
    updatedAt: now,
    messages: [...t.messages, msg],
  }
  all[i] = next
  saveThreads(all)
  return next
}

export function listPrivateNotesForOwner(ownerUserId: string): PrivateOwnerNote[] {
  return loadPrivateNotes()
    .filter((n) => n.ownerUserId === ownerUserId)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

export function addPrivateNote(ownerUserId: string, body: string): PrivateOwnerNote | null {
  const b = body.trim()
  if (!b) return null
  const note: PrivateOwnerNote = {
    id: newId(),
    ownerUserId,
    body: b,
    at: new Date().toISOString(),
  }
  const all = loadPrivateNotes()
  all.unshift(note)
  savePrivateNotes(all)
  return note
}

export function listRemindersForOwner(ownerUserId: string): ReminderOwnerNote[] {
  return loadReminders()
    .filter((n) => n.ownerUserId === ownerUserId)
    .sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime())
}

export function addReminderNote(ownerUserId: string, body: string, remindAtIso: string): ReminderOwnerNote | null {
  const b = body.trim()
  if (!b || !remindAtIso.trim()) return null
  const note: ReminderOwnerNote = {
    id: newId(),
    ownerUserId,
    body: b,
    remindAt: remindAtIso,
    createdAt: new Date().toISOString(),
  }
  const all = loadReminders()
  all.unshift(note)
  saveReminders(all)
  return note
}

export function lastMessagePreview(thread: OwnerAdminThread): string {
  const last = thread.messages[thread.messages.length - 1]
  if (!last) return '—'
  const t = last.body.replace(/\s+/g, ' ').trim()
  return t.length > 120 ? `${t.slice(0, 117)}…` : t
}

const THREAD_READ_KEY = 'rentadria_owner_admin_thread_read_v1'

function loadReadMap(): Record<string, { owner?: string; admin?: string }> {
  try {
    const raw = localStorage.getItem(THREAD_READ_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, { owner?: string; admin?: string }>
  } catch {
    return {}
  }
}

function saveReadMap(m: Record<string, { owner?: string; admin?: string }>) {
  localStorage.setItem(THREAD_READ_KEY, JSON.stringify(m))
}

function lastMsgId(thread: OwnerAdminThread): string | undefined {
  const m = thread.messages[thread.messages.length - 1]
  return m?.id
}

/** Vlasnik je otvorio temu — smatraj pročitanom do zadnje poruke. */
export function markThreadSeenByOwner(threadId: string): void {
  const t = getThread(threadId)
  if (!t) return
  const last = lastMsgId(t)
  if (!last) return
  const m = loadReadMap()
  m[threadId] = { ...m[threadId], owner: last }
  saveReadMap(m)
  try {
    window.dispatchEvent(new Event('rentadria-owner-messages-unread-changed'))
  } catch {
    /* ignore */
  }
}

export function markThreadSeenByAdmin(threadId: string): void {
  const t = getThread(threadId)
  if (!t) return
  const last = lastMsgId(t)
  if (!last) return
  const m = loadReadMap()
  m[threadId] = { ...m[threadId], admin: last }
  saveReadMap(m)
  try {
    window.dispatchEvent(new Event('rentadria-admin-messages-unread-changed'))
  } catch {
    /* ignore */
  }
}

/** Nepregledane teme gdje je zadnja poruka od admina. */
export function getUnreadThreadCountForOwner(ownerUserId: string): number {
  const threads = listThreadsForOwner(ownerUserId)
  const read = loadReadMap()
  let n = 0
  for (const t of threads) {
    const last = lastMsgId(t)
    if (!last) continue
    const lastMsg = t.messages[t.messages.length - 1]!
    if (lastMsg.from !== 'admin') continue
    if (read[t.id]?.owner !== last) n++
  }
  return n
}

/** Nepregledane teme gdje je zadnja poruka od vlasnika. */
export function getUnreadThreadCountForAdmin(): number {
  const threads = listAllThreadsForAdmin()
  const read = loadReadMap()
  let n = 0
  for (const t of threads) {
    const last = lastMsgId(t)
    if (!last) continue
    const lastMsg = t.messages[t.messages.length - 1]!
    if (lastMsg.from !== 'owner') continue
    if (read[t.id]?.admin !== last) n++
  }
  return n
}
