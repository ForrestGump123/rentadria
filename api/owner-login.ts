import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { ownerSessionCookieHeader, signOwnerSessionJwt } from '../server/lib/ownerSessionAuth.js'
import { loginRegisteredOwner } from '../server/lib/registeredOwnersDb.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'

function secureCookie(): boolean {
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'
}

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
  if (!rateLimit(`owner-login:${ip}`, 30, 60_000)) {
    send429(res)
    return
  }

  try {
    const body = parseRequestJsonRecord(req)
    const email = String(body?.email ?? '').trim()
    const password = String(body?.password ?? '')
    if (!email || !password) {
      res.status(400).json({ ok: false, error: 'invalid_body' })
      return
    }

    const result = await loginRegisteredOwner(email, password)
    if (result.ok === false) {
      switch (result.reason) {
        case 'no_backend':
          res.status(503).json({ ok: false, error: 'owner_backend_unavailable' })
          return
        case 'no_password':
          res.status(401).json({ ok: false, error: 'no_password_stored' })
          return
        case 'not_found':
          res.status(404).json({ ok: false, error: 'owner_not_found' })
          return
        case 'bad_password':
          res.status(401).json({ ok: false, error: 'wrong_password' })
          return
        default:
          res.status(401).json({ ok: false, error: 'unauthorized' })
          return
      }
    }
    try {
      const tok = await signOwnerSessionJwt(result.profile.userId)
      res.setHeader('Set-Cookie', ownerSessionCookieHeader(tok, 7 * 24 * 60 * 60, secureCookie()))
    } catch {
      res.status(503).json({ ok: false, error: 'owner_session_unavailable' })
      return
    }
    res.status(200).json({ ok: true, profile: result.profile })
  } catch {
    res.status(400).json({ ok: false, error: 'bad_request' })
  }
}
