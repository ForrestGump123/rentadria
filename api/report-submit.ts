import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { cloudInsertReport } from '../server/lib/rentadriaCloudData.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'

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
  if (!rateLimit(`report-submit:${ip}`, 10, 3_600_000)) {
    send429(res)
    return
  }

  try {
    const body = parseRequestJsonRecord(req)
    const listingId = String(body?.listingId ?? '').trim().slice(0, 200)
    const reason = String(body?.reason ?? '').trim().slice(0, 4000)
    const first = String(body?.first ?? '').trim().slice(0, 120)
    const last = String(body?.last ?? '').trim().slice(0, 120)
    const email = String(body?.email ?? '').trim().toLowerCase().slice(0, 200)
    if (!listingId || !reason || !first || !last || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ ok: false, error: 'invalid_body' })
      return
    }
    const payload: Record<string, unknown> = {
      listingId,
      reason,
      first,
      last,
      email,
      at: new Date().toISOString(),
    }
    const ok = await cloudInsertReport(payload)
    if (!ok) {
      res.status(503).json({ ok: false, error: 'backend_unavailable' })
      return
    }
    res.status(200).json({ ok: true })
  } catch {
    res.status(400).json({ ok: false, error: 'bad_request' })
  }
}
