import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sendSafe500 } from '../server/lib/apiSafe.js'
import { geoFromRequest } from '../server/lib/geoFromRequest.js'
import { rateLimitIp, clientIp } from '../server/lib/rateLimitIp.js'
import { recordVisit } from '../server/lib/siteVisitsStore.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip = clientIp(req)
  if (!rateLimitIp(ip, 30, 60_000)) {
    res.status(429).json({ error: 'rate_limited' })
    return
  }

  try {
    const raw = req.body
    const body =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : typeof raw === 'string'
          ? (JSON.parse(raw) as Record<string, unknown>)
          : {}
    const visitorId = String(body?.visitorId ?? '').trim()
    if (!UUID_RE.test(visitorId)) {
      res.status(400).json({ error: 'invalid_visitor' })
      return
    }

    const { countryCode, city } = geoFromRequest(req)
    const ok = await recordVisit(visitorId, countryCode, city)
    res.status(200).json({ ok: true, recorded: ok })
  } catch (e) {
    sendSafe500(res, e, 'track-visit')
  }
}
