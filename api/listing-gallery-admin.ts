import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { getListingGalleryAdminOverlay } from '../server/lib/listingGalleryAdminDb.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`listing-gallery-admin:${ip}`, 120, 60_000)) {
    send429(res)
    return
  }

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

  const overlay = await getListingGalleryAdminOverlay(lid)
  if (overlay === null) {
    res.status(503).json({ ok: false, error: 'backend_unavailable' })
    return
  }

  res.status(200).json({
    ok: true,
    listingId: lid,
    blockedUrls: overlay.blockedUrls,
    orderedUrls: overlay.orderedUrls,
  })
}
