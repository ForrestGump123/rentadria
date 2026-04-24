/** Per-owner inquiry notification preferences (server-backed via owner cookie). */

export type InquiryNotificationPrefs = {
  /** Glavni prekidač: „Primaj obavještenja za nove upite“. */
  receiveEnabled: boolean
  emailChannel: boolean
  dashboardChannel: boolean
}

const DEFAULT: InquiryNotificationPrefs = {
  receiveEnabled: true,
  emailChannel: true,
  dashboardChannel: true,
}

let cache: InquiryNotificationPrefs | null = null

function normalize(p: Partial<InquiryNotificationPrefs> | null | undefined): InquiryNotificationPrefs {
  const receiveEnabled = p?.receiveEnabled !== false
  return {
    receiveEnabled,
    emailChannel: receiveEnabled && p?.emailChannel !== false,
    dashboardChannel: receiveEnabled && p?.dashboardChannel !== false,
  }
}

export function getInquiryNotificationPrefs(): InquiryNotificationPrefs {
  return cache ?? { ...DEFAULT }
}

export async function pullInquiryNotificationPrefs(): Promise<InquiryNotificationPrefs | null> {
  try {
    const r = await fetch('/api/owner-notification-prefs', { credentials: 'include' })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; prefs?: Partial<InquiryNotificationPrefs> }
    if (!r.ok || !j.ok) return null
    cache = normalize(j.prefs)
    return cache
  } catch {
    return null
  }
}

export async function saveInquiryNotificationPrefs(
  prefs: InquiryNotificationPrefs,
): Promise<{ ok: true } | { ok: false }> {
  const next = normalize(prefs)
  cache = next
  try {
    const r = await fetch('/api/owner-notification-prefs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ prefs: next }),
    })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean }
    if (!r.ok || !j.ok) return { ok: false }
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
