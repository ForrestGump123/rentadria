import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { getPricingOverride } from '../server/lib/pricingOverridesDb.js'

const ALLOWED = new Set(['cnr', 'en', 'sq', 'it', 'es'])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`pricing-overrides:${ip}`, 120, 60_000)) {
    send429(res)
    return
  }

  const locale = typeof req.query?.locale === 'string' ? req.query.locale.trim().toLowerCase() : ''
  if (!ALLOWED.has(locale)) {
    res.status(400).json({ ok: false, error: 'invalid_locale' })
    return
  }

  const plans = await getPricingOverride(locale)
  if (plans === null) {
    res.status(503).json({ ok: false, error: 'backend_unavailable' })
    return
  }
  res.status(200).json({ ok: true, locale, plans })
}

