import type { VercelRequest, VercelResponse } from '@vercel/node'
import { uploadAdminBannerFromDataUrl } from '../server/lib/adminBannerImageStorage.js'
import { send429 } from '../server/lib/apiSafe.js'
import { verifyAdminCookie } from '../server/lib/adminAuthDispatch.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
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
  if (!rateLimit(`admin-banner-upload:${ip}`, 40, 60_000)) {
    send429(res)
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const adminOk = await verifyAdminCookie(cookieHeader)
  if (!adminOk) {
    res.status(401).json({ ok: false })
    return
  }

  try {
    const body = parseRequestJsonRecord(req)
    const imageDataUrl = typeof body?.imageDataUrl === 'string' ? body.imageDataUrl : ''
    if (!imageDataUrl.startsWith('data:image/')) {
      res.status(400).json({ ok: false, error: 'invalid_image' })
      return
    }

    const out = await uploadAdminBannerFromDataUrl(imageDataUrl)
    if (!out.ok) {
      res.status(400).json({ ok: false, error: out.error })
      return
    }
    res.status(200).json({ ok: true, imageUrl: out.publicUrl })
  } catch {
    res.status(400).json({ ok: false, error: 'bad_request' })
  }
}
