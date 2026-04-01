/** Per-owner inquiry notification preferences (localStorage). */

export type InquiryNotificationPrefs = {
  /** Glavni prekidač: „Primaj obavještenja za nove upite“. */
  receiveEnabled: boolean
  emailChannel: boolean
  dashboardChannel: boolean
}

const KEY = 'rentadria_owner_inquiry_notify_prefs_v1'

const DEFAULT: InquiryNotificationPrefs = {
  receiveEnabled: true,
  emailChannel: true,
  dashboardChannel: true,
}

export function getInquiryNotificationPrefs(userId: string): InquiryNotificationPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT }
    const o = JSON.parse(raw) as Record<string, Partial<InquiryNotificationPrefs>>
    const p = o[userId]
    if (!p || typeof p !== 'object') return { ...DEFAULT }
    const receiveEnabled = p.receiveEnabled !== false
    return {
      receiveEnabled,
      emailChannel: receiveEnabled && p.emailChannel !== false,
      dashboardChannel: receiveEnabled && p.dashboardChannel !== false,
    }
  } catch {
    return { ...DEFAULT }
  }
}

export function saveInquiryNotificationPrefs(userId: string, prefs: InquiryNotificationPrefs): void {
  try {
    const raw = localStorage.getItem(KEY)
    const o = raw ? (JSON.parse(raw) as Record<string, InquiryNotificationPrefs>) : {}
    o[userId] = prefs
    localStorage.setItem(KEY, JSON.stringify(o))
  } catch {
    /* ignore */
  }
}
