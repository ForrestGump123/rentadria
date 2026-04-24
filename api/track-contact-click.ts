import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { getSupabaseAdmin } from '../server/lib/supabaseAdmin.js'

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
  if (!rateLimit(`track:contact:${ip}`, 240, 60_000)) {
    send429(res)
    return
  }

  const raw = req.body
  const body =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : typeof raw === 'string'
        ? (JSON.parse(raw) as Record<string, unknown>)
        : {}

  const listingId = String(body?.listingId ?? '').trim()
  if (!listingId) {
    res.status(400).json({ ok: false, error: 'missing_listingId' })
    return
  }

  const sb = getSupabaseAdmin()
  if (!sb) {
    res.status(503).json({ ok: false, error: 'supabase_not_configured' })
    return
  }

  const { data, error } = await sb.rpc('ra_increment_listing_metric', {
    p_public_listing_id: listingId,
    p_metric: 'contact',
  })

  if (error) {
    res.status(500).json({ ok: false, error: error.message })
    return
  }

  res.status(200).json({ ok: true, data })
}

