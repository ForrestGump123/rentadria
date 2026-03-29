const REPORTS = 'rentadria_reports'
const LOGGED = 'rentadria_logged_in'
const ADMIN_REPORTS_UNREAD_KEY = 'rentadria_admin_reports_unread_v1'

export function bumpAdminReportsUnread(): void {
  try {
    const n = Math.max(0, Number(localStorage.getItem(ADMIN_REPORTS_UNREAD_KEY) || '0')) + 1
    localStorage.setItem(ADMIN_REPORTS_UNREAD_KEY, String(n))
    window.dispatchEvent(new Event('rentadria-admin-reports-unread-changed'))
  } catch {
    /* ignore */
  }
}

export function getAdminReportsUnreadCount(): number {
  try {
    return Math.max(0, Number(localStorage.getItem(ADMIN_REPORTS_UNREAD_KEY) || '0'))
  } catch {
    return 0
  }
}

export function clearAdminReportsUnread(): void {
  try {
    localStorage.removeItem(ADMIN_REPORTS_UNREAD_KEY)
    window.dispatchEvent(new Event('rentadria-admin-reports-unread-changed'))
  } catch {
    /* ignore */
  }
}

export function saveReport(payload: Record<string, string>) {
  const prev = JSON.parse(localStorage.getItem(REPORTS) || '[]') as Record<string, string>[]
  prev.push({ ...payload, at: new Date().toISOString() })
  localStorage.setItem(REPORTS, JSON.stringify(prev))
  bumpAdminReportsUnread()
  try {
    window.dispatchEvent(new Event('rentadria-reports-updated'))
  } catch {
    /* ignore */
  }
}

export function loadAllReports(): (Record<string, string> & { at?: string })[] {
  try {
    const raw = localStorage.getItem(REPORTS) || '[]'
    const prev = JSON.parse(raw) as unknown
    return Array.isArray(prev) ? (prev as (Record<string, string> & { at?: string })[]) : []
  } catch {
    return []
  }
}

export function isLoggedIn(): boolean {
  return localStorage.getItem(LOGGED) === '1'
}

export function setLoggedIn(v: boolean) {
  localStorage.setItem(LOGGED, v ? '1' : '0')
  try {
    window.dispatchEvent(new Event('rentadria-auth'))
  } catch {
    /* ignore */
  }
}
