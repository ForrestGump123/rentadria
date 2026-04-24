import { getSupabaseAdmin } from './supabaseAdmin.js'

const T_INQ = 'rentadria_visitor_inquiries'
const T_UNREAD = 'rentadria_owner_inquiry_unread'

export type VisitorInquiryRow = {
  id: string
  ownerUserId: string
  at: string
  listingId: string
  listingTitle: string
  first: string
  last: string
  email: string
  phone: string
  period: string
  guests: string
  message: string
  paused?: boolean
  ownerReply?: string
}

function rowToApi(r: Record<string, unknown>): VisitorInquiryRow | null {
  const id = typeof r.id === 'string' ? r.id : ''
  const ownerUserId = typeof r.owner_user_id === 'string' ? r.owner_user_id.trim().toLowerCase() : ''
  if (!id || !ownerUserId) return null
  return {
    id,
    ownerUserId,
    at: typeof r.created_at === 'string' ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    listingId: typeof r.listing_id === 'string' ? r.listing_id : '',
    listingTitle: typeof r.listing_title === 'string' ? r.listing_title : '',
    first: typeof r.guest_first === 'string' ? r.guest_first : '',
    last: typeof r.guest_last === 'string' ? r.guest_last : '',
    email: typeof r.guest_email === 'string' ? r.guest_email : '',
    phone: typeof r.guest_phone === 'string' ? r.guest_phone : '',
    period: typeof r.period === 'string' ? r.period : '',
    guests: typeof r.guests === 'string' ? r.guests : '',
    message: typeof r.message === 'string' ? r.message : '',
    paused: Boolean(r.paused),
    ownerReply: typeof r.owner_reply === 'string' ? r.owner_reply : undefined,
  }
}

export async function insertInquiryAndBumpUnread(input: Omit<VisitorInquiryRow, 'id' | 'at'>): Promise<string | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const { data, error } = await sb.rpc('ra_insert_inquiry_and_bump_unread', {
    p_owner_user_id: input.ownerUserId,
    p_listing_id: input.listingId,
    p_listing_title: input.listingTitle,
    p_guest_first: input.first,
    p_guest_last: input.last,
    p_guest_email: input.email,
    p_guest_phone: input.phone,
    p_period: input.period,
    p_guests: input.guests,
    p_message: input.message,
  })
  if (error) return null
  return typeof data === 'string' ? data : null
}

export async function listInquiriesForOwner(ownerUserId: string): Promise<VisitorInquiryRow[] | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const uid = ownerUserId.trim().toLowerCase()
  const { data, error } = await sb.from(T_INQ).select('*').eq('owner_user_id', uid).order('created_at', { ascending: false }).limit(1000)
  if (error || !Array.isArray(data)) return null
  const out: VisitorInquiryRow[] = []
  for (const raw of data) {
    const m = rowToApi(raw as Record<string, unknown>)
    if (m) out.push(m)
  }
  return out
}

export async function listInquiriesForAdmin(): Promise<VisitorInquiryRow[] | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const { data, error } = await sb.from(T_INQ).select('*').order('created_at', { ascending: false }).limit(2000)
  if (error || !Array.isArray(data)) return null
  const out: VisitorInquiryRow[] = []
  for (const raw of data) {
    const m = rowToApi(raw as Record<string, unknown>)
    if (m) out.push(m)
  }
  return out
}

export async function updateInquiryByAdmin(ownerUserId: string, inquiryId: string, patch: { message?: string; ownerReply?: string; paused?: boolean }): Promise<boolean> {
  const sb = getSupabaseAdmin()
  if (!sb) return false
  const uid = ownerUserId.trim().toLowerCase()
  const id = inquiryId.trim()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof patch.message === 'string') updates.message = patch.message.slice(0, 8000)
  if (typeof patch.ownerReply === 'string') updates.owner_reply = patch.ownerReply.slice(0, 8000)
  if (typeof patch.paused === 'boolean') updates.paused = patch.paused
  const { error } = await sb.from(T_INQ).update(updates).eq('id', id).eq('owner_user_id', uid)
  return !error
}

export async function deleteInquiryByAdmin(ownerUserId: string, inquiryId: string): Promise<boolean> {
  const sb = getSupabaseAdmin()
  if (!sb) return false
  const uid = ownerUserId.trim().toLowerCase()
  const id = inquiryId.trim()
  const { error } = await sb.from(T_INQ).delete().eq('id', id).eq('owner_user_id', uid)
  return !error
}

export async function getOwnerUnread(ownerUserId: string): Promise<number | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const uid = ownerUserId.trim().toLowerCase()
  const { data, error } = await sb.from(T_UNREAD).select('unread_count').eq('owner_user_id', uid).maybeSingle()
  if (error) return null
  if (!data || typeof data !== 'object') return 0
  return Math.max(0, Number((data as { unread_count?: unknown }).unread_count) || 0)
}

export async function clearOwnerUnread(ownerUserId: string): Promise<boolean> {
  const sb = getSupabaseAdmin()
  if (!sb) return false
  const uid = ownerUserId.trim().toLowerCase()
  const { error } = await sb.from(T_UNREAD).upsert({ owner_user_id: uid, unread_count: 0, updated_at: new Date().toISOString() }, { onConflict: 'owner_user_id' })
  return !error
}

