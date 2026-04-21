import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { ownerSessionCookieHeader, signOwnerSessionJwt } from '../server/lib/ownerSessionAuth.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { getRegisteredOwnerProfile } from '../server/lib/registeredOwnersDb.js'
import { verifyOwnerLoginLinkToken } from '../server/lib/verifyJwt.js'

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
  if (!rateLimit(`owner-login-verify:${ip}`, 40, 60_000)) {
    send429(res)
    return
  }

  try {
    const body = parseRequestJsonRecord(req)
    const token = String(body?.token ?? '').trim()
    if (!token) {
      res.status(400).json({ ok: false, error: 'missing_token' })
      return
    }

    const v = await verifyOwnerLoginLinkToken(token)
    if (!v?.email) {
      res.status(401).json({ ok: false, error: 'invalid_token' })
      return
    }

    const profile = await getRegisteredOwnerProfile(v.email)
    if (!profile) {
      res.status(404).json({ ok: false, error: 'owner_not_found' })
      return
    }

    let sessionTok: string
    try {
      sessionTok = await signOwnerSessionJwt(profile.userId)
    } catch {
      res.status(503).json({ ok: false, error: 'owner_session_not_configured' })
      return
    }
    res.setHeader('Set-Cookie', ownerSessionCookieHeader(sessionTok, 7 * 24 * 60 * 60, secureCookie()))
    res.status(200).json({ ok: true, profile })
  } catch {
    res.status(400).json({ ok: false, error: 'bad_request' })
  }
}

