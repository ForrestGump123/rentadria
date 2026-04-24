import { markOwnerNotificationReadOnCloud, pullOwnerNotificationsFromCloud, type OwnerNotificationPayload } from '../lib/ownerProfileCloud'

const KEY = 'rentadria_owner_notifications_v1'

export type OwnerNotification = OwnerNotificationPayload

function load(): OwnerNotification[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const a = JSON.parse(raw) as unknown
    return Array.isArray(a) ? (a as OwnerNotification[]) : []
  } catch {
    return []
  }
}

function save(rows: OwnerNotification[]) {
  localStorage.setItem(KEY, JSON.stringify(rows))
  try {
    window.dispatchEvent(new Event('rentadria-owner-notifications-updated'))
  } catch {
    /* ignore */
  }
}

export function listOwnerNotifications(): OwnerNotification[] {
  return load()
}

export function unreadOwnerNotificationsCount(): number {
  return load().filter((n) => !n.readAt).length
}

export async function pullOwnerNotificationsToLocal(limit = 50): Promise<boolean> {
  const rows = await pullOwnerNotificationsFromCloud(limit)
  if (!rows) return false
  save(rows)
  return true
}

export async function markOwnerNotificationRead(id: string): Promise<boolean> {
  const ok = await markOwnerNotificationReadOnCloud(id)
  if (!ok) return false
  const cur = load()
  const next = cur.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
  save(next)
  return true
}

