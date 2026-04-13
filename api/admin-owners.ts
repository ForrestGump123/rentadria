import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { verifyAdminCookie } from '../server/lib/adminAuthDispatch.js'
import { listRegisteredOwnersForAdmin } from '../server/lib/registeredOwnersDb.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'

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
  if (!rateLimit(`admin-owners:${ip}`, 40, 60_000)) {
    send429(res)
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const ok = await verifyAdminCookie(cookieHeader)
  if (!ok) {
    res.status(401).json({ ok: false })
    return
  }

  const owners = await listRegisteredOwnersForAdmin()
  res.status(200).json({ ok: true, owners })
}
