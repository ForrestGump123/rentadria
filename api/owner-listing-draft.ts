import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { ownerUserIdFromCookie } from '../server/lib/ownerSessionAuth.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { getSupabaseAdmin } from '../server/lib/supabaseAdmin.js'
import { getListingDraft, upsertListingDraft, type ListingDraftCategory } from '../server/lib/listingDraftsDb.js'

function parseCat(raw: unknown): ListingDraftCategory | null {
  if (raw === 'accommodation' || raw === 'car' || raw === 'motorcycle') return raw
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`owner-listing-draft:${ip}`, 80, 60_000)) {
    send429(res)
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const ownerUid = await ownerUserIdFromCookie(cookieHeader)
  if (!ownerUid) {
    res.status(401).json({ ok: false, error: 'owner_auth_required' })
    return
  }

  const sb = getSupabaseAdmin()
  if (!sb) {
    res.status(503).json({ ok: false, error: 'owner_backend_unavailable' })
    return
  }

  if (req.method === 'GET') {
    const rowId = typeof req.query.rowId === 'string' ? req.query.rowId.trim() : ''
    const cat = parseCat(typeof req.query.category === 'string' ? req.query.category : null)
    if (!rowId || !cat) {
      res.status(400).json({ ok: false, error: 'invalid_query' })
      return
    }

    // Ensure listing row belongs to owner.
    const { data: row } = await sb
      .from('rentadria_owner_listings')
      .select('id, user_id')
      .eq('id', rowId)
      .maybeSingle()
    const uid = typeof row?.user_id === 'string' ? row.user_id.trim().toLowerCase() : ''
    if (!uid || uid !== ownerUid) {
      res.status(404).json({ ok: false, error: 'not_found' })
      return
    }

    const draft = await getListingDraft({ ownerUserId: ownerUid, ownerRowId: rowId, category: cat })
    res.status(200).json({ ok: true, draft: draft?.draft ?? null })
    return
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const body = parseRequestJsonRecord(req)
    const rowId = typeof body.rowId === 'string' ? body.rowId.trim() : ''
    const cat = parseCat(body.category)
    const rawDraft = body.draft
    if (!rowId || !cat || !rawDraft || typeof rawDraft !== 'object' || Array.isArray(rawDraft)) {
      res.status(400).json({ ok: false, error: 'invalid_body' })
      return
    }

    const { data: row } = await sb
      .from('rentadria_owner_listings')
      .select('id, user_id')
      .eq('id', rowId)
      .maybeSingle()
    const uid = typeof row?.user_id === 'string' ? row.user_id.trim().toLowerCase() : ''
    if (!uid || uid !== ownerUid) {
      res.status(404).json({ ok: false, error: 'not_found' })
      return
    }

    const ok = await upsertListingDraft({
      ownerUserId: ownerUid,
      ownerRowId: rowId,
      category: cat,
      draft: rawDraft as Record<string, unknown>,
    })
    res.status(ok ? 200 : 500).json({ ok })
    return
  }

  res.status(405).json({ ok: false })
}

