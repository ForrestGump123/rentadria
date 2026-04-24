import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuthIpFromVercel, verifyAdminCookie } from '../server/lib/adminAuthDispatch.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { rateLimitIp } from '../server/lib/rateLimitIp.js'
import { getSupabaseAdmin } from '../server/lib/supabaseAdmin.js'
import { upsertListingGalleryAdmin } from '../server/lib/listingGalleryAdminDb.js'

function parseUrlArray(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const x of raw) {
    if (typeof x !== 'string') continue
    const s = x.trim()
    if (!s || s.length > 4000) continue
    out.push(s)
    if (out.length >= max) break
  }
  return out
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'PUT') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }

  const ip = adminAuthIpFromVercel(req)
  if (!rateLimitIp(ip, 120, 60_000)) {
    res.status(429).json({ ok: false, error: 'rate_limited' })
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const adminOk = await verifyAdminCookie(cookieHeader)
  if (!adminOk) {
    res.status(401).json({ ok: false })
    return
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    res.status(503).json({ ok: false, error: 'supabase_not_configured' })
    return
  }

  try {
    const body = parseRequestJsonRecord(req)
    const listingId = typeof body?.listingId === 'string' ? body.listingId.trim() : ''
    const ownerUserIdBody = typeof body?.ownerUserId === 'string' ? body.ownerUserId.trim().toLowerCase() : ''
    const blockedUrls = parseUrlArray(body?.blockedUrls, 200)
    const orderedUrls = parseUrlArray(body?.orderedUrls, 200)
    if (!listingId) {
      res.status(400).json({ ok: false, error: 'invalid_body' })
      return
    }

    const { data: row, error: qErr } = await supabase
      .from('rentadria_owner_listings')
      .select('user_id, public_listing_id')
      .eq('public_listing_id', listingId)
      .maybeSingle()

    if (qErr || !row || typeof row !== 'object') {
      res.status(400).json({ ok: false, error: 'listing_not_found' })
      return
    }

    const ownerFromRow = typeof (row as { user_id?: unknown }).user_id === 'string'
      ? (row as { user_id: string }).user_id.trim().toLowerCase()
      : ''
    if (!ownerFromRow) {
      res.status(400).json({ ok: false, error: 'listing_not_found' })
      return
    }

    if (ownerUserIdBody && ownerUserIdBody !== ownerFromRow) {
      res.status(400).json({ ok: false, error: 'owner_mismatch' })
      return
    }

    const ok = await upsertListingGalleryAdmin({
      listingId,
      ownerUserId: ownerFromRow,
      blockedUrls,
      orderedUrls,
    })
    if (!ok) {
      res.status(503).json({ ok: false, error: 'save_failed' })
      return
    }
    res.status(200).json({ ok: true })
  } catch {
    res.status(400).json({ ok: false, error: 'bad_request' })
  }
}
