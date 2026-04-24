import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { listAdminBanners } from '../server/lib/adminBannersDb.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'

/** Javno čitanje reklama za početnu / popup (bez admin kolačića). */
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
  if (!rateLimit(`public-banners:${ip}`, 120, 60_000)) {
    send429(res)
    return
  }

  const rows = await listAdminBanners()
  if (!rows) {
    res.status(503).json({ ok: false, error: 'no_backend' })
    return
  }
  res.status(200).json({ ok: true, banners: rows })
}
