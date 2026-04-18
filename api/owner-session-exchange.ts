import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { ownerSessionCookieHeader, signOwnerSessionJwt } from '../server/lib/ownerSessionAuth.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { verifyOwnerSessionExchangeToken } from '../server/lib/verifyJwt.js'

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
  if (!rateLimit(`owner-sess-ex:${ip}`, 20, 60_000)) {
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
    const email = await verifyOwnerSessionExchangeToken(token)
    if (!email) {
      res.status(401).json({ ok: false, error: 'invalid_token' })
      return
    }
    let sessionTok: string
    try {
      sessionTok = await signOwnerSessionJwt(email)
    } catch {
      res.status(503).json({ ok: false, error: 'owner_session_not_configured' })
      return
    }
    const sec = secureCookie()
    res.setHeader('Set-Cookie', ownerSessionCookieHeader(sessionTok, 7 * 24 * 60 * 60, sec))
    res.status(200).json({ ok: true })
  } catch {
    res.status(400).json({ ok: false, error: 'bad_request' })
  }
}
