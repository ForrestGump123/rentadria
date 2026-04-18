import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { verifyAdminCookie } from '../server/lib/adminAuthDispatch.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import {
  cloudListAllReviewsForAdmin,
  cloudReplaceReviews,
  type StoredReviewJson,
} from '../server/lib/rentadriaCloudData.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'

function normalizeReviews(raw: unknown): StoredReviewJson[] | null {
  if (!Array.isArray(raw)) return null
  const out: StoredReviewJson[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : ''
    const rating = Number(o.rating)
    const text = typeof o.text === 'string' ? o.text : ''
    const at = typeof o.at === 'string' && o.at.trim() ? o.at.trim() : new Date().toISOString()
    if (!id || !Number.isFinite(rating) || rating < 1 || rating > 5) continue
    if (text.length > 8000) continue
    const rec: StoredReviewJson = { id, rating, text, at }
    if ('hidden' in o) rec.hidden = o.hidden === true
    if ('blocked' in o) rec.blocked = o.blocked === true
    out.push(rec)
  }
  return out
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`admin-listing-rev:${ip}`, 60, 60_000)) {
    send429(res)
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const adminOk = await verifyAdminCookie(cookieHeader)
  if (!adminOk) {
    res.status(401).json({ ok: false })
    return
  }

  try {
    if (req.method === 'GET') {
      const items = await cloudListAllReviewsForAdmin()
      res.status(200).json({ ok: true, items })
      return
    }

    if (req.method === 'PUT') {
      const body = parseRequestJsonRecord(req)
      const listingId = String(body?.listingId ?? '').trim()
      const reviews = normalizeReviews(body?.reviews)
      if (!listingId || reviews === null) {
        res.status(400).json({ ok: false, error: 'invalid_body' })
        return
      }
      const ok = await cloudReplaceReviews(listingId, reviews)
      if (!ok) {
        res.status(503).json({ ok: false, error: 'backend_unavailable' })
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
