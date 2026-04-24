import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { verifyAdminCookie } from '../server/lib/adminAuthDispatch.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import {
  deleteLegalOverride,
  legalKindOk,
  legalLocaleOk,
  saveLegalOverride,
  type LegalOverrideKind,
} from '../server/lib/legalOverridesDb.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`admin-legal:${ip}`, 80, 60_000)) {
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
    const kindRaw = String(body?.kind ?? '').trim().toLowerCase()
    const localeRaw = String(body?.locale ?? '').trim().toLowerCase()
    if (!legalKindOk(kindRaw)) {
      res.status(400).json({ ok: false, error: 'invalid_kind' })
      return
    }
    if (!legalLocaleOk(localeRaw)) {
      res.status(400).json({ ok: false, error: 'invalid_locale' })
      return
    }

    const action = typeof body?.action === 'string' ? body.action.trim() : ''
    if (action === 'reset') {
      const ok = await deleteLegalOverride(kindRaw as LegalOverrideKind, localeRaw)
      res.status(ok ? 200 : 503).json({ ok })
      return
    }

    const content = body?.content
    if (!Array.isArray(content)) {
      res.status(400).json({ ok: false, error: 'invalid_content' })
      return
    }
    const ok = await saveLegalOverride(kindRaw as LegalOverrideKind, localeRaw, content)
    res.status(ok ? 200 : 503).json({ ok })
  } catch {
    res.status(400).json({ ok: false, error: 'bad_request' })
  }
}

