import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import {
  cloudAppendReview,
  cloudGetReviews,
  type StoredReviewJson,
} from '../server/lib/rentadriaCloudData.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'

function parseReview(o: Record<string, unknown>): StoredReviewJson | null {
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : ''
  const rating = Number(o.rating)
  const text = typeof o.text === 'string' ? o.text.trim() : ''
  const at = typeof o.at === 'string' && o.at.trim() ? o.at.trim() : new Date().toISOString()
  if (!id || !Number.isFinite(rating) || rating < 1 || rating > 5) return null
  if (!text || text.length > 8000) return null
  return { id, rating, text, at }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const ip = clientIp(req)

  if (req.method === 'GET') {
    const lid =
      typeof req.query.listingId === 'string'
        ? req.query.listingId.trim()
        : Array.isArray(req.query.listingId)
          ? String(req.query.listingId[0]).trim()
          : ''
    if (!lid) {
      res.status(400).json({ ok: false, error: 'missing_listing_id' })
      return
    }
    const rows = await cloudGetReviews(lid)
    if (rows === null) {
      res.status(503).json({ ok: false, error: 'backend_unavailable' })
      return
    }
    res.status(200).json({ ok: true, reviews: rows })
    return
  }

  if (req.method === 'POST') {
    if (!rateLimit(`listing-rev-post:${ip}`, 15, 3_600_000)) {
      send429(res)
      return
    }
    try {
      const body = parseRequestJsonRecord(req)
      const listingId = String(body?.listingId ?? '').trim()
      const revRaw = body?.review
      if (!listingId || !revRaw || typeof revRaw !== 'object' || Array.isArray(revRaw)) {
        res.status(400).json({ ok: false, error: 'invalid_body' })
        return
      }
      const review = parseReview(revRaw as Record<string, unknown>)
      if (!review) {
        res.status(400).json({ ok: false, error: 'invalid_review' })
        return
      }
      const ok = await cloudAppendReview(listingId, review)
      if (!ok) {
        res.status(503).json({ ok: false, error: 'backend_unavailable' })
        return
      }
      res.status(200).json({ ok: true })
    } catch {
      res.status(400).json({ ok: false, error: 'bad_request' })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
