import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuthIpFromVercel, verifyAdminCookie } from '../server/lib/adminAuthDispatch.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { rateLimitIp } from '../server/lib/rateLimitIp.js'
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

  if (req.method === 'GET') {
    const ownerUserId = typeof req.query.ownerUserId === 'string' ? req.query.ownerUserId.trim().toLowerCase() : ''
    const rowId = typeof req.query.rowId === 'string' ? req.query.rowId.trim() : ''
    const cat = parseCat(typeof req.query.category === 'string' ? req.query.category : null)
    if (!ownerUserId || !rowId || !cat) {
      res.status(400).json({ ok: false, error: 'invalid_query' })
      return
    }
    const draft = await getListingDraft({ ownerUserId, ownerRowId: rowId, category: cat })
    res.status(200).json({ ok: true, draft: draft?.draft ?? null })
    return
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const body = parseRequestJsonRecord(req)
    const ownerUserId = typeof body.ownerUserId === 'string' ? body.ownerUserId.trim().toLowerCase() : ''
    const rowId = typeof body.rowId === 'string' ? body.rowId.trim() : ''
    const cat = parseCat(body.category)
    const rawDraft = body.draft
    if (!ownerUserId || !rowId || !cat || !rawDraft || typeof rawDraft !== 'object' || Array.isArray(rawDraft)) {
      res.status(400).json({ ok: false, error: 'invalid_body' })
      return
    }
    const ok = await upsertListingDraft({
      ownerUserId,
      ownerRowId: rowId,
      category: cat,
      draft: rawDraft as Record<string, unknown>,
    })
    res.status(ok ? 200 : 500).json({ ok })
    return
  }

  res.status(405).json({ ok: false })
}

