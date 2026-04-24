import type { ListingCategory } from '../types'

export type SyncPartner = {
  id: string
  name: string
  baseUrl: string
  apiKey?: string
  categories: Record<ListingCategory, boolean>
  createdAt: string
  updatedAt: string
}

export type ImportOwnerSettings = {
  ownerUserId: string
  feedUrl: string | null
  fieldMapping: Record<string, string>
  updatedAt: string
}

export type SyncJob = {
  id: string
  at: string
  scope: 'owner' | 'site'
  ownerUserId?: string | null
  partnerId?: string | null
  categories: ListingCategory[]
  status: 'ok' | 'error'
  message: string
}

export async function fetchImportPartners(): Promise<SyncPartner[] | null> {
  try {
    const r = await fetch('/api/admin-import-partners', { credentials: 'include' })
    if (r.status === 503) return null
    if (!r.ok) return null
    const j = (await r.json()) as { ok?: boolean; rows?: SyncPartner[] }
    if (!j.ok || !Array.isArray(j.rows)) return null
    return j.rows
  } catch {
    return null
  }
}

export async function upsertImportPartner(partner: {
  id: string
  name: string
  baseUrl: string
  apiKey?: string
  categories: Record<ListingCategory, boolean>
}): Promise<boolean> {
  try {
    const r = await fetch('/api/admin-import-partners', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partner }),
    })
    return r.ok
  } catch {
    return false
  }
}

export async function deleteImportPartner(id: string): Promise<boolean> {
  try {
    const r = await fetch(`/api/admin-import-partners?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    return r.ok
  } catch {
    return false
  }
}

export async function fetchImportOwnerSettings(ownerUserId: string): Promise<ImportOwnerSettings | null> {
  try {
    const r = await fetch(`/api/admin-import-owner-settings?ownerUserId=${encodeURIComponent(ownerUserId)}`, {
      credentials: 'include',
    })
    if (r.status === 503) return null
    if (!r.ok) return null
    const j = (await r.json()) as { ok?: boolean; row?: ImportOwnerSettings }
    if (!j.ok || !j.row) return null
    return j.row
  } catch {
    return null
  }
}

export async function saveImportOwnerSettings(input: {
  ownerUserId: string
  feedUrl: string | null
  fieldMapping: Record<string, string>
}): Promise<boolean> {
  try {
    const r = await fetch('/api/admin-import-owner-settings', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    return r.ok
  } catch {
    return false
  }
}

export async function fetchImportJobs(limit = 30): Promise<SyncJob[] | null> {
  try {
    const r = await fetch(`/api/admin-import-jobs?limit=${encodeURIComponent(String(limit))}`, { credentials: 'include' })
    if (r.status === 503) return null
    if (!r.ok) return null
    const j = (await r.json()) as { ok?: boolean; rows?: SyncJob[] }
    if (!j.ok || !Array.isArray(j.rows)) return null
    return j.rows
  } catch {
    return null
  }
}

