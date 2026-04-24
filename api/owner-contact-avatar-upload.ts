import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { ownerUserIdFromCookie } from '../server/lib/ownerSessionAuth.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { uploadContactAvatarFromDataUrl } from '../server/lib/ownerAvatarImageStorage.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`owner-contact-avatar-upload:${ip}`, 60, 60_000)) {
    send429(res)
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const ownerUid = await ownerUserIdFromCookie(cookieHeader)
  if (!ownerUid) {
    res.status(401).json({ ok: false, error: 'owner_auth_required' })
    return
  }

  const body = parseRequestJsonRecord(req)
  const contactId = typeof body?.contactId === 'string' ? body.contactId.trim() : ''
  const dataUrl = typeof body?.dataUrl === 'string' ? body.dataUrl : ''
  if (!contactId || contactId.length > 120) {
    res.status(400).json({ ok: false, error: 'invalid_contact_id' })
    return
  }
  if (!dataUrl.trim().startsWith('data:image/')) {
    res.status(400).json({ ok: false, error: 'invalid_data_url' })
    return
  }

  const r = await uploadContactAvatarFromDataUrl(ownerUid, contactId, dataUrl)
  if (r.ok === false) {
    res.status(r.error === 'no_backend' ? 503 : 400).json({ ok: false, error: r.error })
    return
  }
  res.status(200).json({ ok: true, publicUrl: r.publicUrl })
}
