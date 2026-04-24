import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { verifyAdminCookie } from '../server/lib/adminAuthDispatch.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { deleteInquiryByAdmin, listInquiriesForAdmin, updateInquiryByAdmin } from '../server/lib/visitorInquiriesDb.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`admin-inquiries:${ip}`, 120, 60_000)) {
    send429(res)
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const adminOk = await verifyAdminCookie(cookieHeader)
  if (!adminOk) {
    res.status(401).json({ ok: false })
    return
  }

  if (req.method === 'GET') {
    const rows = await listInquiriesForAdmin()
    if (rows === null) {
      res.status(503).json({ ok: false, error: 'no_backend' })
      return
    }
    res.status(200).json({ ok: true, inquiries: rows })
    return
  }

  if (req.method === 'POST') {
    try {
      const body = parseRequestJsonRecord(req)
      const action = String(body?.action ?? '').trim()
      const ownerUserId = String(body?.ownerUserId ?? '').trim().toLowerCase()
      const id = String(body?.id ?? '').trim()
      if (!ownerUserId || !id) {
        res.status(400).json({ ok: false, error: 'missing_fields' })
        return
      }
      if (action === 'delete') {
        const ok = await deleteInquiryByAdmin(ownerUserId, id)
        res.status(ok ? 200 : 503).json({ ok })
        return
      }
      const patch = body?.patch && typeof body.patch === 'object' && !Array.isArray(body.patch) ? (body.patch as Record<string, unknown>) : {}
      const ok = await updateInquiryByAdmin(ownerUserId, id, {
        message: typeof patch.message === 'string' ? patch.message : undefined,
        ownerReply: typeof patch.ownerReply === 'string' ? patch.ownerReply : undefined,
        paused: typeof patch.paused === 'boolean' ? patch.paused : undefined,
      })
      res.status(ok ? 200 : 503).json({ ok })
    } catch {
      res.status(400).json({ ok: false, error: 'bad_request' })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}

