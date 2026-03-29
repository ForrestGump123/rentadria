import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sendSafe500, send429 } from '../server/lib/apiSafe.js'
import { getSupabaseAdmin } from '../server/lib/supabaseAdmin.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-social-secret')
}

function parseBody(req: VercelRequest): Record<string, unknown> {
  const raw = req.body
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return {}
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`soc:enq:${ip}`, 12, 3_600_000)) {
    send429(res)
    return
  }

  const secret = process.env.SOCIAL_ENQUEUE_SECRET?.trim()
  if (process.env.VERCEL_ENV === 'production' && !secret) {
    res.status(503).json({ error: 'social_enqueue_secret_required' })
    return
  }
  if (secret) {
    const h = String(req.headers['x-social-secret'] ?? '').trim()
    if (h !== secret) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    res.status(503).json({ error: 'supabase_not_configured' })
    return
  }

  const body = parseBody(req)
  const listingPublicId = String(body?.listingPublicId ?? '').trim().slice(0, 240)
  const category = String(body?.category ?? 'accommodation').trim()
  if (!listingPublicId) {
    res.status(400).json({ error: 'missing_listingPublicId' })
    return
  }
  if (!['accommodation', 'car', 'motorcycle'].includes(category)) {
    res.status(400).json({ error: 'invalid_category' })
    return
  }

  const payload = {
    title: String(body?.title ?? '').trim().slice(0, 500),
    location: String(body?.location ?? '').trim().slice(0, 500),
    priceLabel: String(body?.priceLabel ?? '').trim().slice(0, 80),
    phone: String(body?.phone ?? '').trim().slice(0, 80),
    imageDataUrl:
      typeof body?.imageDataUrl === 'string' && body.imageDataUrl.startsWith('data:')
        ? body.imageDataUrl.slice(0, 6_500_000)
        : null,
  }

  const { data, error } = await supabase.rpc('enqueue_social_post', {
    p_listing_public_id: listingPublicId,
    p_category: category,
    p_payload: payload,
  })

  if (error) {
    console.error('enqueue_social_post', error.message)
    sendSafe500(res, error, 'social-enqueue')
    return
  }

  res.status(200).json({ ok: true, queueId: data })
}
