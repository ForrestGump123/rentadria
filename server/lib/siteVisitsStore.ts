import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { belgradeYmd } from './belgradeDate.js'

export type DayBucket = {
  visitorIds: Record<string, true>
  byCountry: Record<string, number>
  /** Ključ: "CC|Grad" ili "CC|" ako nema grada */
  byCity: Record<string, number>
}

export type SiteVisitsData = {
  v: 1
  days: Record<string, DayBucket>
}

export function emptyVisits(): SiteVisitsData {
  return { v: 1, days: {} }
}

const DATA_FILE = join(process.cwd(), 'api', 'data', 'site-visits.json')

/** In-memory fallback (serverless warm instance). */
let memory: SiteVisitsData | null = null

function loadFromFile(): SiteVisitsData | null {
  try {
    if (!existsSync(DATA_FILE)) return null
    const raw = readFileSync(DATA_FILE, 'utf8')
    const p = JSON.parse(raw) as SiteVisitsData
    if (!p || p.v !== 1 || typeof p.days !== 'object') return null
    return p
  } catch {
    return null
  }
}

function saveToFile(data: SiteVisitsData): void {
  try {
    if (process.env.VERCEL === '1') return
    const dir = join(process.cwd(), 'api', 'data')
    mkdirSync(dir, { recursive: true })
    writeFileSync(DATA_FILE, JSON.stringify(data), 'utf8')
  } catch {
    /* read-only ili nema fs */
  }
}

export async function loadVisits(): Promise<SiteVisitsData> {
  if (memory) return memory
  const f = loadFromFile()
  if (f) {
    memory = f
    return f
  }
  memory = emptyVisits()
  return memory
}

export async function saveVisits(data: SiteVisitsData): Promise<void> {
  memory = data
  saveToFile(data)
}

const cityKey = (countryCode: string, city: string) =>
  `${countryCode}|${city.trim() || '—'}`

/**
 * Jedna „posjeta“ = jedan visitorId po kalendarskom danu (Europe/Belgrade).
 * Vraća true ako je novi zapis (broj posjeta povećan).
 */
export async function recordVisit(
  visitorId: string,
  countryCode: string,
  city: string,
): Promise<boolean> {
  const day = belgradeYmd()
  const data = await loadVisits()
  let bucket = data.days[day]
  if (!bucket) {
    bucket = { visitorIds: {}, byCountry: {}, byCity: {} }
    data.days[day] = bucket
  }
  if (bucket.visitorIds[visitorId]) {
    return false
  }
  bucket.visitorIds[visitorId] = true
  const cc = countryCode.slice(0, 2).toUpperCase() || 'XX'
  bucket.byCountry[cc] = (bucket.byCountry[cc] ?? 0) + 1
  const ck = cityKey(cc, city)
  bucket.byCity[ck] = (bucket.byCity[ck] ?? 0) + 1
  await saveVisits(data)
  return true
}

export function dayTotal(day: string, data: SiteVisitsData): number {
  const b = data.days[day]
  if (!b) return 0
  return Object.keys(b.visitorIds).length
}

/** Sum dnevnih posjeta u mjesecu yyyy-mm */
export function monthTotal(ym: string, data: SiteVisitsData): number {
  let s = 0
  for (const d of Object.keys(data.days)) {
    if (d.startsWith(`${ym}-`)) s += dayTotal(d, data)
  }
  return s
}

/** Sum dnevnih posjeta u godini yyyy */
export function yearTotal(year: string, data: SiteVisitsData): number {
  let s = 0
  for (const d of Object.keys(data.days)) {
    if (d.startsWith(`${year}-`)) s += dayTotal(d, data)
  }
  return s
}

/** Agregat byCountry / byCity za jedan dan */
export function dayBreakdown(day: string, data: SiteVisitsData): {
  byCountry: Record<string, number>
  byCity: Record<string, number>
} {
  const b = data.days[day]
  if (!b) return { byCountry: {}, byCity: {} }
  return { byCountry: { ...b.byCountry }, byCity: { ...b.byCity } }
}

/** Agregat za cijeli mjesec (suma po zemljama/gradovima) */
export function monthBreakdown(ym: string, data: SiteVisitsData): {
  byCountry: Record<string, number>
  byCity: Record<string, number>
} {
  const byCountry: Record<string, number> = {}
  const byCity: Record<string, number> = {}
  for (const d of Object.keys(data.days)) {
    if (!d.startsWith(`${ym}-`)) continue
    const b = data.days[d]
    if (!b) continue
    for (const [k, v] of Object.entries(b.byCountry)) {
      byCountry[k] = (byCountry[k] ?? 0) + v
    }
    for (const [k, v] of Object.entries(b.byCity)) {
      byCity[k] = (byCity[k] ?? 0) + v
    }
  }
  return { byCountry, byCity }
}

/** Agregat za godinu */
export function yearBreakdown(year: string, data: SiteVisitsData): {
  byCountry: Record<string, number>
  byCity: Record<string, number>
} {
  const byCountry: Record<string, number> = {}
  const byCity: Record<string, number> = {}
  for (const d of Object.keys(data.days)) {
    if (!d.startsWith(`${year}-`)) continue
    const b = data.days[d]
    if (!b) continue
    for (const [k, v] of Object.entries(b.byCountry)) {
      byCountry[k] = (byCountry[k] ?? 0) + v
    }
    for (const [k, v] of Object.entries(b.byCity)) {
      byCity[k] = (byCity[k] ?? 0) + v
    }
  }
  return { byCountry, byCity }
}

export function yearsInData(data: SiteVisitsData): string[] {
  const set = new Set<string>()
  for (const d of Object.keys(data.days)) {
    set.add(d.slice(0, 4))
  }
  const y = belgradeYmd().slice(0, 4)
  set.add(y)
  return [...set].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
}
