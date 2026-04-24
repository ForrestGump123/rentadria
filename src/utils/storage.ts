const LOGGED = 'rentadria_logged_in'
let unreadReports = 0

export function bumpAdminReportsUnread(): void {
  try {
    unreadReports = Math.max(0, unreadReports) + 1
    window.dispatchEvent(new Event('rentadria-admin-reports-unread-changed'))
  } catch {
    /* ignore */
  }
}

export function getAdminReportsUnreadCount(): number {
  return Math.max(0, unreadReports)
}

export function clearAdminReportsUnread(): void {
  try {
    unreadReports = 0
    window.dispatchEvent(new Event('rentadria-admin-reports-unread-changed'))
  } catch {
    /* ignore */
  }
}

export function saveReport(payload: Record<string, string>) {
  void fetch('/api/report-submit', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      listingId: payload.listingId ?? '',
      reason: payload.reason ?? '',
      first: payload.first ?? '',
      last: payload.last ?? '',
      email: payload.email ?? '',
    }),
  }).catch(() => {})
  bumpAdminReportsUnread()
  try {
    window.dispatchEvent(new Event('rentadria-reports-updated'))
  } catch {
    /* ignore */
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
