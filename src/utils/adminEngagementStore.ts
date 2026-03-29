/**
 * Agregat klikova „Prikaži kontakt“ za admin izvještaj (mjesec YYYY-MM).
 * Broji se samo kada se u incrementContactClickForListing poveća brojač oglasa.
 */

const KEY = 'rentadria_admin_engagement_v1'

type MonthAgg = {
  contactClicks: number
  byOwner: Record<string, number>
}

function load(): Record<string, MonthAgg> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as unknown
    return o && typeof o === 'object' ? (o as Record<string, MonthAgg>) : {}
  } catch {
    return {}
  }
}

function save(m: Record<string, MonthAgg>) {
  localStorage.setItem(KEY, JSON.stringify(m))
}

function ymNow(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function recordAdminContactClick(userId: string): void {
  const y = ymNow()
  const m = load()
  const cur = m[y] ?? { contactClicks: 0, byOwner: {} }
  cur.contactClicks += 1
  cur.byOwner[userId] = (cur.byOwner[userId] ?? 0) + 1
  m[y] = cur
  save(m)
}

export function getMonthContactAggregate(y: string): MonthAgg {
  return load()[y] ?? { contactClicks: 0, byOwner: {} }
}

export function listMonthKeys(): string[] {
  return Object.keys(load()).sort()
}
