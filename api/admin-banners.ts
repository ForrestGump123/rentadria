import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { verifyAdminCookie } from '../server/lib/adminAuthDispatch.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { deleteAdminBanner, listAdminBanners, upsertAdminBanner } from '../server/lib/adminBannersDb.js'

const SLOTS = new Set(['slideshow', 'left', 'right', 'popup'])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`admin-banners:${ip}`, 80, 60_000)) {
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
    if (req.method === 'GET') {
      const rows = await listAdminBanners()
      if (!rows) {
        res.status(503).json({ ok: false, error: 'no_backend' })
        return
      }
      res.status(200).json({ ok: true, banners: rows })
      return
    }

    if (req.method === 'POST') {
      const body = parseRequestJsonRecord(req)
      const id = typeof body?.id === 'string' && body.id.trim() ? body.id.trim() : null
      const slot = String(body?.slot ?? '').trim()
      if (!SLOTS.has(slot)) {
        res.status(400).json({ ok: false, error: 'invalid_slot' })
        return
      }
      const title = String(body?.title ?? '').trim().slice(0, 140)
      const description = String(body?.description ?? '').trim().slice(0, 600)
      const imageUrl = typeof body?.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim() : undefined
      const imageDataUrlRaw = body?.imageDataUrl
      const imageDataUrl =
        typeof imageDataUrlRaw === 'string' && imageDataUrlRaw.trim() ? String(imageDataUrlRaw) : undefined
      const removeImage = body?.removeImage === true
      const countries = Array.isArray(body?.countries) ? body.countries.filter((x: unknown) => typeof x === 'string') : []
      const startDate = typeof body?.startDate === 'string' && body.startDate.trim() ? body.startDate.trim() : null
      const endDate = typeof body?.endDate === 'string' && body.endDate.trim() ? body.endDate.trim() : null

      const r = await upsertAdminBanner({
        id,
        slot: slot as 'slideshow' | 'left' | 'right' | 'popup',
        title,
        description,
        ...(imageUrl ? { imageUrl } : {}),
        ...(imageDataUrl !== undefined ? { imageDataUrl } : {}),
        removeImage,
        countries,
        startDate,
        endDate,
      })
      res.status(r.ok ? 200 : 400).json({ ok: r.ok, id: r.id, error: r.error })
      return
    }

    if (req.method === 'DELETE') {
      const id = typeof req.query?.id === 'string' ? req.query.id.trim() : ''
      if (!id) {
        res.status(400).json({ ok: false, error: 'missing_id' })
        return
      }
      const ok = await deleteAdminBanner(id)
      res.status(ok ? 200 : 503).json({ ok })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch {
    res.status(400).json({ ok: false, error: 'bad_request' })
  }
}

