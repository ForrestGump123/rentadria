export function dispatchMessagesUpdated() {
  try {
    window.dispatchEvent(new Event('rentadria-owner-messages-updated'))
  } catch {
    /* ignore */
  }
}

export type MessageParty = 'owner' | 'admin'

export type OwnerAdminThread = {
  id: string
  ownerUserId: string
  ownerEmail?: string
  subject: string
  createdAt: string
  updatedAt: string
  lastMessage: string
  lastFrom: MessageParty
  messageCount: number
  unreadForOwner: boolean
  unreadForAdmin: boolean
}

export type OwnerAdminMessage = {
  id: string
  from: MessageParty
  body: string
  at: string
}

const JSON_HDR = { 'Content-Type': 'application/json' } as const

let ownerThreadsCache: OwnerAdminThread[] = []
let adminThreadsCache: OwnerAdminThread[] = []

export function listThreadsForOwner(): OwnerAdminThread[] {
  return ownerThreadsCache.slice()
}

export function listAllThreadsForAdmin(): OwnerAdminThread[] {
  return adminThreadsCache.slice()
}

export function getUnreadThreadCountForOwner(): number {
  return ownerThreadsCache.filter((t) => t.unreadForOwner).length
}

export function getUnreadThreadCountForAdmin(): number {
  return adminThreadsCache.filter((t) => t.unreadForAdmin).length
}

export async function pullThreadsForOwner(): Promise<boolean> {
  try {
    const r = await fetch('/api/owner-admin-threads', { credentials: 'include' })
    const j = (await r.json()) as { ok?: boolean; threads?: OwnerAdminThread[] }
    if (!r.ok || !j.ok || !Array.isArray(j.threads)) return false
    ownerThreadsCache = j.threads
    dispatchMessagesUpdated()
    try {
      window.dispatchEvent(new Event('rentadria-owner-messages-unread-changed'))
    } catch {
      /* ignore */
    }
    return true
  } catch {
    return false
  }
}

export async function pullThreadsForAdmin(): Promise<boolean> {
  try {
    const r = await fetch('/api/admin-owner-threads', { credentials: 'include' })
    const j = (await r.json()) as { ok?: boolean; threads?: OwnerAdminThread[] }
    if (!r.ok || !j.ok || !Array.isArray(j.threads)) return false
    adminThreadsCache = j.threads
    dispatchMessagesUpdated()
    try {
      window.dispatchEvent(new Event('rentadria-admin-messages-unread-changed'))
    } catch {
      /* ignore */
    }
    return true
  } catch {
    return false
  }
}

export async function getThreadMessagesOwner(threadId: string): Promise<OwnerAdminMessage[] | null> {
  try {
    const q = new URLSearchParams({ id: threadId })
    const r = await fetch(`/api/owner-admin-thread?${q}`, { credentials: 'include' })
    const j = (await r.json()) as { ok?: boolean; messages?: OwnerAdminMessage[] }
    if (!r.ok || !j.ok || !Array.isArray(j.messages)) return null
    return j.messages
  } catch {
    return null
  }
}

export async function getThreadMessagesAdmin(threadId: string): Promise<OwnerAdminMessage[] | null> {
  try {
    const q = new URLSearchParams({ id: threadId })
    const r = await fetch(`/api/admin-owner-thread?${q}`, { credentials: 'include' })
    const j = (await r.json()) as { ok?: boolean; messages?: OwnerAdminMessage[] }
    if (!r.ok || !j.ok || !Array.isArray(j.messages)) return null
    return j.messages
  } catch {
    return null
  }
}

export async function createOwnerThread(opts: { ownerUserId: string; ownerEmail?: string; subject: string; body: string }): Promise<boolean> {
  try {
    const r = await fetch('/api/owner-admin-threads', {
      method: 'POST',
      credentials: 'include',
      headers: JSON_HDR,
      body: JSON.stringify({ subject: opts.subject, body: opts.body, ownerEmail: opts.ownerEmail ?? '' }),
    })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean }
    if (!r.ok || j.ok !== true) return false
    await pullThreadsForOwner()
    return true
  } catch {
    return false
  }
}

export async function appendThreadMessage(opts: { threadId: string; from: MessageParty; body: string; actingOwnerUserId?: string }): Promise<boolean> {
  try {
    if (opts.from === 'owner') {
      const r = await fetch(`/api/owner-admin-thread?id=${encodeURIComponent(opts.threadId)}`, {
        method: 'POST',
        credentials: 'include',
        headers: JSON_HDR,
        body: JSON.stringify({ body: opts.body }),
      })
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean }
      if (!r.ok || j.ok !== true) return false
      await pullThreadsForOwner()
      return true
    }
    const r = await fetch(`/api/admin-owner-thread?id=${encodeURIComponent(opts.threadId)}`, {
      method: 'POST',
      credentials: 'include',
      headers: JSON_HDR,
      body: JSON.stringify({ body: opts.body }),
    })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean }
    if (!r.ok || j.ok !== true) return false
    await pullThreadsForAdmin()
    return true
  } catch {
    return false
  }
}

export async function markThreadSeenByOwner(threadId: string): Promise<void> {
  try {
    await fetch(`/api/owner-admin-thread?id=${encodeURIComponent(threadId)}`, {
      method: 'POST',
      credentials: 'include',
      headers: JSON_HDR,
      body: JSON.stringify({ action: 'seen' }),
    })
    await pullThreadsForOwner()
  } catch {
    /* ignore */
  }
}

export async function markThreadSeenByAdmin(threadId: string): Promise<void> {
  try {
    await fetch(`/api/admin-owner-thread?id=${encodeURIComponent(threadId)}`, {
      method: 'POST',
      credentials: 'include',
      headers: JSON_HDR,
      body: JSON.stringify({ action: 'seen' }),
    })
    await pullThreadsForAdmin()
  } catch {
    /* ignore */
  }
}

export function lastMessagePreview(thread: OwnerAdminThread): string {
  const t = (thread.lastMessage || '').replace(/\s+/g, ' ').trim()
  return t.length > 120 ? `${t.slice(0, 117)}…` : t || '—'
}
