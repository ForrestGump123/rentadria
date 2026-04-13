import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { loginRegisteredOwner } from '../server/lib/registeredOwnersDb.js'
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

    const profile = await loginRegisteredOwner(email, password)
    if (!profile) {
      res.status(401).json({ ok: false, error: 'unauthorized' })
      return
    }

    res.status(200).json({ ok: true, profile })
  } catch {
    res.status(400).json({ ok: false, error: 'bad_request' })
  }
}
