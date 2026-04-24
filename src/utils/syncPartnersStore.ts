import type { ListingCategory } from '../types'

export type SyncPartner = {
  id: string
  name: string
  baseUrl: string
  apiKey?: string
  categories: Record<ListingCategory, boolean>
  createdAt: string
  updatedAt?: string
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

// Storage is server-backed; keep this file as shared types only.
