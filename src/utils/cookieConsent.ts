const KEY = 'rentadria_cookie_consent_v2'

export type CookiePrefs = {
  essential: true
  analytics: boolean
}

export function readCookiePrefs(): CookiePrefs | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const j = JSON.parse(raw) as Partial<CookiePrefs> & { v?: number }
    return {
      essential: true,
      analytics: Boolean(j.analytics),
    }
  } catch {
    return null
  }
}

export function saveCookiePrefs(prefs: CookiePrefs): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ v: 2, essential: true, analytics: prefs.analytics, at: Date.now() }),
    )
  } catch {
    /* ignore */
  }
}

export function hasCookieDecision(): boolean {
  return readCookiePrefs() !== null
}
