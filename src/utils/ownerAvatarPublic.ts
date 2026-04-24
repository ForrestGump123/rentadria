/** Avatar za javni prikaz oglasa (server-backed; cached locally). */

const KEY = 'rentadria_owner_avatar_by_user_v1'
const inflight = new Map<string, Promise<string | null>>()

function load(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== 'object') return {}
    return o as Record<string, string>
  } catch {
    return {}
  }
}

function save(m: Record<string, string>) {
  localStorage.setItem(KEY, JSON.stringify(m))
}

export function getOwnerAvatarPublic(userId: string): string | null {
  const v = load()[userId]?.trim()
  if (!v) return null
  if (v.startsWith('data:image/')) return v
  if (/^https?:\/\//i.test(v)) return v
  return v
}

export function setOwnerAvatarPublic(userId: string, url: string | null): void {
  const m = load()
  if (url && url.trim().length > 0) {
    m[userId] = url.trim()
  } else {
    delete m[userId]
  }
  save(m)
}

export async function pullOwnerAvatarPublic(userId: string): Promise<string | null> {
  const uid = userId.trim().toLowerCase()
  if (!uid) return null
  const ex = inflight.get(uid)
  if (ex) return ex
  const p = (async () => {
  try {
    const q = new URLSearchParams({ userId: uid })
    const r = await fetch(`/api/owner-avatar?${q}`)
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; avatarUrl?: string | null }
    if (!r.ok || !j.ok) return null
    const v = typeof j.avatarUrl === 'string' ? j.avatarUrl.trim() : ''
    setOwnerAvatarPublic(uid, v || null)
    return v || null
  } catch {
    return null
  } finally {
    inflight.delete(uid)
  }
  })()
  inflight.set(uid, p)
  return p
}
