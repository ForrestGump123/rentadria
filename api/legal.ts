import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { getLegalOverride, legalKindOk, legalLocaleOk, type LegalOverrideKind } from '../server/lib/legalOverridesDb.js'

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
  if (!rateLimit(`legal:${ip}`, 200, 60_000)) {
    send429(res)
    return
  }

  const kindRaw = typeof req.query?.kind === 'string' ? req.query.kind.trim().toLowerCase() : ''
  const localeRaw = typeof req.query?.locale === 'string' ? req.query.locale.trim().toLowerCase() : ''
  if (!legalKindOk(kindRaw)) {
    res.status(400).json({ ok: false, error: 'invalid_kind' })
    return
  }
  if (!legalLocaleOk(localeRaw)) {
    res.status(400).json({ ok: false, error: 'invalid_locale' })
    return
  }

  const content = await getLegalOverride(kindRaw as LegalOverrideKind, localeRaw)
  if (content === null) {
    res.status(503).json({ ok: false, error: 'backend_unavailable' })
    return
  }
  res.status(200).json({ ok: true, kind: kindRaw, locale: localeRaw, content })
}

