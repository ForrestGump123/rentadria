import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { verifyAdminCookie } from '../server/lib/adminAuthDispatch.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { deletePricingOverride, savePricingOverride } from '../server/lib/pricingOverridesDb.js'

const ALLOWED = new Set(['cnr', 'en', 'sq', 'it', 'es'])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`admin-pricing-overrides:${ip}`, 80, 60_000)) {
    send429(res)
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const adminOk = await verifyAdminCookie(cookieHeader)
  if (!adminOk) {
    res.status(401).json({ ok: false })
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const body = parseRequestJsonRecord(req)
    const locale = String(body?.locale ?? '').trim().toLowerCase()
    if (!ALLOWED.has(locale)) {
      res.status(400).json({ ok: false, error: 'invalid_locale' })
      return
    }
    const action = typeof body?.action === 'string' ? body.action.trim() : ''
    if (action === 'reset') {
      const ok = await deletePricingOverride(locale)
      res.status(ok ? 200 : 503).json({ ok })
      return
    }
    const plans = body?.plans
    if (!Array.isArray(plans)) {
      res.status(400).json({ ok: false, error: 'invalid_plans' })
      return
    }
    const ok = await savePricingOverride(locale, plans)
    res.status(ok ? 200 : 503).json({ ok })
  } catch {
    res.status(400).json({ ok: false, error: 'bad_request' })
  }
}

