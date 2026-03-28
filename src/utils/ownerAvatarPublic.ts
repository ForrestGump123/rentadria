/** Avatar za javni prikaz oglasa (lookup po userId, bez obaveznog logina kao taj vlasnik). */

const KEY = 'rentadria_owner_avatar_by_user_v1'

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
  if (!v || !v.startsWith('data:image/')) return null
  return v
}

export function setOwnerAvatarPublic(userId: string, dataUrl: string | null): void {
  const m = load()
  if (dataUrl && dataUrl.trim().length > 0) {
    m[userId] = dataUrl.trim()
  } else {
    delete m[userId]
  }
  save(m)
}
