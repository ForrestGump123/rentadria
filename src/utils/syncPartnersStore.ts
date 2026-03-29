import type { ListingCategory } from '../types'

const PARTNERS_KEY = 'rentadria_admin_sync_partners'
const JOBS_KEY = 'rentadria_admin_sync_jobs'

export type SyncPartner = {
  id: string
  name: string
  baseUrl: string
  apiKey?: string
  categories: Record<ListingCategory, boolean>
  createdAt: string
}

export type SyncScope = 'owner' | 'site'

export type SyncJobRecord = {
  id: string
  at: string
  scope: SyncScope
  userId?: string
  partnerId: string
  categories: ListingCategory[]
  status: 'ok' | 'error'
  message: string
}

function uid(): string {
  return `sync-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function loadPartners(): SyncPartner[] {
  try {
    const raw = localStorage.getItem(PARTNERS_KEY)
    if (!raw) return []
    const a = JSON.parse(raw) as SyncPartner[]
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}

function savePartners(p: SyncPartner[]) {
  localStorage.setItem(PARTNERS_KEY, JSON.stringify(p))
}

export function upsertPartner(p: Omit<SyncPartner, 'id' | 'createdAt'> & { id?: string }): SyncPartner {
  const list = loadPartners()
  const id = p.id ?? uid()
  const row: SyncPartner = {
    id,
    name: p.name.trim(),
    baseUrl: p.baseUrl.trim().replace(/\/$/, ''),
    apiKey: p.apiKey?.trim(),
    categories: p.categories,
    createdAt: list.find((x) => x.id === id)?.createdAt ?? new Date().toISOString(),
  }
  const i = list.findIndex((x) => x.id === id)
  if (i >= 0) list[i] = row
  else list.push(row)
  savePartners(list)
  return row
}

export function deletePartner(id: string) {
  savePartners(loadPartners().filter((x) => x.id !== id))
}

export function loadJobs(limit = 40): SyncJobRecord[] {
  try {
    const raw = localStorage.getItem(JOBS_KEY)
    if (!raw) return []
    const a = JSON.parse(raw) as SyncJobRecord[]
    if (!Array.isArray(a)) return []
    return a.slice(-limit)
  } catch {
    return []
  }
}

function pushJob(job: SyncJobRecord) {
  const next = [...loadJobs(200), job].slice(-80)
  localStorage.setItem(JOBS_KEY, JSON.stringify(next))
}

/** Stub: u produkciji bi pozivali partner API / slali payload. */
export function runSyncJob(opts: {
  scope: SyncScope
  userId?: string
  partner: SyncPartner
  categories: ListingCategory[]
  /** Samo prefiks u log poruci (npr. test). */
  label?: string
}): SyncJobRecord {
  const cats = opts.categories.filter((c) => opts.partner.categories[c])
  const job: SyncJobRecord = {
    id: uid(),
    at: new Date().toISOString(),
    scope: opts.scope,
    userId: opts.userId,
    partnerId: opts.partner.id,
    categories: cats.length ? cats : (['accommodation', 'car', 'motorcycle'] as ListingCategory[]).filter(
      (c) => opts.partner.categories[c],
    ),
    status: cats.length === 0 ? 'error' : 'ok',
    message:
      cats.length === 0
        ? 'Nema preklapanja kategorija između izbora i partnera.'
        : `${opts.label ? `${opts.label} ` : ''}Stub sinhronizacije: ${opts.scope}${opts.userId ? ` (${opts.userId})` : ''} → ${opts.partner.name} [${cats.join(', ')}]`,
  }
  pushJob(job)
  return job
}
