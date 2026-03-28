/** Kalendarski dan u Europe/Belgrade (isti smisao kao na serveru). */
export function belgradeYmdClient(): string {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'Europe/Belgrade',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

const VID_KEY = 'rentadria_visitor_id'
const TRACKED_DAY_KEY = 'rentadria_visit_tracked_day'

function getOrCreateVisitorId(): string {
  try {
    let v = localStorage.getItem(VID_KEY)
    if (!v) {
      v =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(VID_KEY, v)
    }
    return v
  } catch {
    return `${Date.now()}-anon`
  }
}

/**
 * Jedna posjeta po danu po pregledaču: šalje POST samo prvi put tog dana (Belgrade).
 */
export async function trackSiteVisitOncePerDay(): Promise<void> {
  try {
    const today = belgradeYmdClient()
    try {
      if (localStorage.getItem(TRACKED_DAY_KEY) === today) return
    } catch {
      /* private mode */
    }

    const visitorId = getOrCreateVisitorId()
    const res = await fetch('/api/track-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId }),
      credentials: 'same-origin',
    })
    if (!res.ok) return

    try {
      localStorage.setItem(TRACKED_DAY_KEY, today)
    } catch {
      /* ignore */
    }
  } catch {
    /* offline / nema API u dev */
  }
}
