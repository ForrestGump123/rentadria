import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { ownerUserIdFromCookie } from '../server/lib/ownerSessionAuth.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import {
  cloudDeleteOwnerListing,
  cloudListOwnerListings,
  type CloudOwnerListingRow,
  cloudUpsertOwnerListing,
} from '../server/lib/rentadriaCloudData.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { getRegisteredOwnerAdminFlags } from '../server/lib/registeredOwnersDb.js'

function parseListing(rec: Record<string, unknown>, ownerUid: string): CloudOwnerListingRow | null {
  const id = typeof rec.id === 'string' ? rec.id.trim() : ''
  const userId = typeof rec.userId === 'string' ? rec.userId.trim().toLowerCase() : ''
  const cat = rec.category
  if (!id || userId !== ownerUid) return null
  if (cat !== 'accommodation' && cat !== 'car' && cat !== 'motorcycle') return null
  return {
    id,
    userId,
    category: cat,
    title: typeof rec.title === 'string' ? rec.title : '',
    viewsMonth: Math.max(0, Math.min(1_000_000, Number(rec.viewsMonth) || 0)),
    contactClicksMonth: Math.max(0, Math.min(1_000_000, Number(rec.contactClicksMonth) || 0)),
    receivedAt: typeof rec.receivedAt === 'string' ? rec.receivedAt : '',
    expiresAt: typeof rec.expiresAt === 'string' ? rec.expiresAt : '',
    featuredUntil:
      rec.featuredUntil === null || rec.featuredUntil === undefined
        ? null
        : typeof rec.featuredUntil === 'string'
          ? rec.featuredUntil
          : null,
    internalNote:
      rec.internalNote === null || rec.internalNote === undefined
        ? null
        : typeof rec.internalNote === 'string'
          ? rec.internalNote
          : null,
    publicListingId:
      typeof rec.publicListingId === 'string' && rec.publicListingId.trim()
        ? rec.publicListingId.trim()
        : undefined,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`owner-listings:${ip}`, 60, 60_000)) {
    send429(res)
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const ownerUid = await ownerUserIdFromCookie(cookieHeader)
  if (!ownerUid) {
    res.status(401).json({ ok: false, error: 'owner_auth_required' })
    return
  }

  try {
    if (req.method === 'GET') {
      const rows = await cloudListOwnerListings(ownerUid)
      if (rows === null) {
        res.status(503).json({ ok: false, error: 'owner_backend_unavailable' })
        return
      }
      res.status(200).json({ ok: true, listings: rows })
      return
    }

    if (req.method === 'POST') {
      const flags = await getRegisteredOwnerAdminFlags(ownerUid)
      if (flags?.deleted) {
        res.status(410).json({ ok: false, error: 'owner_deleted' })
        return
      }
      if (flags?.blocked) {
        res.status(403).json({ ok: false, error: 'owner_blocked' })
        return
      }
      const body = parseRequestJsonRecord(req)
      const listingRaw = body?.listing
      if (!listingRaw || typeof listingRaw !== 'object' || Array.isArray(listingRaw)) {
        res.status(400).json({ ok: false, error: 'invalid_body' })
        return
      }
      const row = parseListing(listingRaw as Record<string, unknown>, ownerUid)
      if (!row) {
        res.status(400).json({ ok: false, error: 'invalid_listing' })
        return
      }
      const okUpsert = await cloudUpsertOwnerListing(row)
      if (!okUpsert) {
        res.status(503).json({ ok: false, error: 'owner_backend_unavailable' })
        return
      }
      res.status(200).json({ ok: true })
      return
    }

    if (req.method === 'DELETE') {
      const flags = await getRegisteredOwnerAdminFlags(ownerUid)
      if (flags?.deleted) {
        res.status(410).json({ ok: false, error: 'owner_deleted' })
        return
      }
      if (flags?.blocked) {
        res.status(403).json({ ok: false, error: 'owner_blocked' })
        return
      }
      const q = req.query
      const id = typeof q.id === 'string' ? q.id.trim() : Array.isArray(q.id) ? String(q.id[0]).trim() : ''
      if (!id) {
        res.status(400).json({ ok: false, error: 'missing_id' })
        return
      }
      const okDel = await cloudDeleteOwnerListing(ownerUid, id)
      if (!okDel) {
        res.status(503).json({ ok: false, error: 'owner_backend_unavailable' })
        return
      }
      res.status(200).json({ ok: true })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch {
    res.status(400).json({ ok: false, error: 'bad_request' })
  }
}
