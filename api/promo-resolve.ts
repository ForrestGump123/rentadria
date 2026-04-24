import type { VercelRequest, VercelResponse } from '@vercel/node'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { parsePromoRecordJson } from '../server/lib/promoServerValidate.js'
import { clientIp, rateLimitIp } from '../server/lib/rateLimitIp.js'
import { getSupabaseAdmin } from '../server/lib/supabaseAdmin.js'

/**
 * Rješavanje koda: Supabase (`rentadria_promo_codes`), zatim opcioni `RENTADRIA_ADMIN_PROMO_JSON` ako je postavljen.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false })
    return
  }

  const ip = clientIp(req)
  if (!rateLimitIp(ip, 40, 60_000)) {
    res.status(429).json({ ok: false, error: 'rate_limited' })
    return
  }

  const body = parseRequestJsonRecord(req)
  const rawCode = typeof body.code === 'string' ? body.code : ''
  const code = rawCode.trim().toUpperCase().replace(/\s+/g, '')
  if (!code) {
    res.status(400).json({ ok: false })
    return
  }

  const supabase = getSupabaseAdmin()
  if (supabase) {
    const { data: row, error } = await supabase.from('rentadria_promo_codes').select('record').eq('code', code).maybeSingle()
    if (!error && row?.record) {
      const parsed = parsePromoRecordJson(row.record)
      if (parsed) {
        res.status(200).json({ ok: true, record: parsed })
        return
      }
    }
  }

  const blob = process.env.RENTADRIA_ADMIN_PROMO_JSON?.trim()
  if (!blob) {
    res.status(404).json({ ok: false })
    return
  }

  try {
    const rows = JSON.parse(blob) as unknown
    if (!Array.isArray(rows)) {
      res.status(500).json({ ok: false })
      return
    }
    const record = rows.find(
      (x) => x && typeof x === 'object' && String((x as { code?: string }).code ?? '').toUpperCase() === code,
    ) as Record<string, unknown> | undefined
    if (!record || typeof record.code !== 'string') {
      res.status(404).json({ ok: false })
      return
    }
    res.status(200).json({ ok: true, record })
  } catch {
    res.status(500).json({ ok: false })
  }
}
