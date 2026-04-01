import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuthIpFromVercel, verifyAdminCookie } from '../server/lib/adminAuthDispatch.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { parsePromoRecordJson } from '../server/lib/promoServerValidate.js'
import { rateLimitIp } from '../server/lib/rateLimitIp.js'
import { getSupabaseAdmin } from '../server/lib/supabaseAdmin.js'

/**
 * CRUD promotivnih kodova u Supabase (samo admin sesija).
 * GET lista, POST upsert jednog zapisa, DELETE ?id=
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const ip = adminAuthIpFromVercel(req)
  if (!rateLimitIp(ip, 60, 60_000)) {
    res.status(429).json({ ok: false, error: 'rate_limited' })
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const adminOk = await verifyAdminCookie(cookieHeader)
  if (!adminOk) {
    res.status(401).json({ ok: false })
    return
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    res.status(503).json({ ok: false, error: 'supabase_not_configured' })
    return
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('rentadria_promo_codes').select('record').order('updated_at', {
      ascending: false,
    })
    if (error) {
      res.status(500).json({ ok: false })
      return
    }
    const records = (data ?? [])
      .map((r) => (r.record ? parsePromoRecordJson(r.record) : null))
      .filter((x): x is NonNullable<typeof x> => x != null)
    res.status(200).json({ ok: true, records })
    return
  }

  if (req.method === 'POST') {
    const body = parseRequestJsonRecord(req)
    const raw = body.record
    if (!raw || typeof raw !== 'object') {
      res.status(400).json({ ok: false, error: 'invalid_body' })
      return
    }
    const rec = parsePromoRecordJson(raw)
    if (!rec || !rec.id || !rec.code) {
      res.status(400).json({ ok: false, error: 'invalid_record' })
      return
    }
    const code = rec.code.trim().toUpperCase()
    const { error } = await supabase.from('rentadria_promo_codes').upsert(
      {
        id: rec.id,
        code,
        record: rec as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    if (error) {
      res.status(500).json({ ok: false })
      return
    }
    res.status(200).json({ ok: true })
    return
  }

  if (req.method === 'DELETE') {
    const q = req.query.id
    const id = typeof q === 'string' ? q : Array.isArray(q) ? q[0] : ''
    if (!id) {
      res.status(400).json({ ok: false })
      return
    }
    const { error } = await supabase.from('rentadria_promo_codes').delete().eq('id', id)
    if (error) {
      res.status(500).json({ ok: false })
      return
    }
    res.status(200).json({ ok: true })
    return
  }

  res.status(405).json({ ok: false })
}
