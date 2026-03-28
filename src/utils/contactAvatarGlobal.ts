/**
 * Slike dodatnih kontakata koje vlasnik želi prikazati na svim svojim oglasima
 * (lookup po userId + contactId).
 */

const KEY = 'rentadria_contact_avatar_global_v1'

type MapShape = Record<string, Record<string, string>>

function load(): MapShape {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== 'object') return {}
    return o as MapShape
  } catch {
    return {}
  }
}

function save(m: MapShape) {
  localStorage.setItem(KEY, JSON.stringify(m))
}

export function getContactAvatarGlobal(ownerUserId: string, contactId: string): string | null {
  const v = load()[ownerUserId]?.[contactId]?.trim()
  if (!v || !v.startsWith('data:image/')) return null
  return v
}

/** Poziva se nakon snimanja nacrta (modal) da se globalna mapa poklopi s kontaktima. */
export function syncContactAvatarGlobals(ownerUserId: string, contacts: { id: string; type: string; showAvatarOnAllListings?: boolean; avatarDataUrl?: string | null }[]): void {
  try {
    const m = load()
    const contactIds = new Set(contacts.filter((c) => c.type === 'contact').map((c) => c.id))
    const nextUser: Record<string, string> = { ...(m[ownerUserId] ?? {}) }

    for (const c of contacts) {
      if (c.type !== 'contact') continue
      if (c.showAvatarOnAllListings && c.avatarDataUrl?.trim()) {
        nextUser[c.id] = c.avatarDataUrl.trim()
      } else {
        delete nextUser[c.id]
      }
    }
    for (const id of Object.keys(nextUser)) {
      if (!contactIds.has(id)) delete nextUser[id]
    }

    m[ownerUserId] = nextUser
    if (Object.keys(nextUser).length === 0) delete m[ownerUserId]
    save(m)
  } catch {
    /* ignore */
  }
}
