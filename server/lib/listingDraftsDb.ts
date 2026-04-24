import { getSupabaseAdmin } from './supabaseAdmin.js'

const T = 'rentadria_listing_drafts'

export type ListingDraftCategory = 'accommodation' | 'car' | 'motorcycle'

export type ListingDraftRow = {
  ownerUserId: string
  ownerRowId: string
  category: ListingDraftCategory
  draft: Record<string, unknown>
  updatedAt: string
}

function normUid(s: string): string {
  return s.trim().toLowerCase()
}

export async function getListingDraft(input: {
  ownerUserId: string
  ownerRowId: string
  category: ListingDraftCategory
}): Promise<ListingDraftRow | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const uid = normUid(input.ownerUserId)
  const rowId = input.ownerRowId.trim()
  const cat = input.category
  if (!uid || !rowId) return null
  const { data, error } = await sb
    .from(T)
    .select('owner_user_id, owner_row_id, category, draft, updated_at')
    .eq('owner_user_id', uid)
    .eq('owner_row_id', rowId)
    .eq('category', cat)
    .maybeSingle()
  if (error) return null
  if (!data || typeof data !== 'object') return null
  const r = data as Record<string, unknown>
  const draft = r.draft && typeof r.draft === 'object' && !Array.isArray(r.draft) ? (r.draft as Record<string, unknown>) : null
  if (!draft) return null
  return {
    ownerUserId: uid,
    ownerRowId: rowId,
    category: cat,
    draft,
    updatedAt: typeof r.updated_at === 'string' ? r.updated_at : new Date().toISOString(),
  }
}

export async function upsertListingDraft(input: {
  ownerUserId: string
  ownerRowId: string
  category: ListingDraftCategory
  draft: Record<string, unknown>
}): Promise<boolean> {
  const sb = getSupabaseAdmin()
  if (!sb) return false
  const uid = normUid(input.ownerUserId)
  const rowId = input.ownerRowId.trim()
  const cat = input.category
  if (!uid || !rowId) return false
  const row = {
    owner_user_id: uid,
    owner_row_id: rowId,
    category: cat,
    draft: input.draft,
    updated_at: new Date().toISOString(),
  }
  const { error } = await sb.from(T).upsert(row, { onConflict: 'owner_user_id,owner_row_id,category' })
  return !error
}

