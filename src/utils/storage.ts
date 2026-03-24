const INQUIRIES = 'rentadria_inquiries'
const REPORTS = 'rentadria_reports'
const LOGGED = 'rentadria_logged_in'

export function saveInquiry(payload: Record<string, string>) {
  const prev = JSON.parse(localStorage.getItem(INQUIRIES) || '[]') as Record<string, string>[]
  prev.push({ ...payload, at: new Date().toISOString() })
  localStorage.setItem(INQUIRIES, JSON.stringify(prev))
}

export function saveReport(payload: Record<string, string>) {
  const prev = JSON.parse(localStorage.getItem(REPORTS) || '[]') as Record<string, string>[]
  prev.push({ ...payload, at: new Date().toISOString() })
  localStorage.setItem(REPORTS, JSON.stringify(prev))
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
