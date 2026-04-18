import type { VercelRequest, VercelResponse } from '@vercel/node'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { clientIp, rateLimitIp } from '../server/lib/rateLimitIp.js'
import {
  parsePromoRecordJson,
  validatePromoRecordOnServer,
  type PromoRecordShape,
} from '../server/lib/promoServerValidate.js'
import { getSupabaseAdmin } from '../server/lib/supabaseAdmin.js'

/**
 * Jednokratna aktivacija koda na serveru (brojač uses + redemption red).
 * Javni endpoint; rate limit; jedinstven par (promo_id, user_id).
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
  if (!rateLimitIp(ip, 30, 60_000)) {
    res.status(429).json({ ok: false, error: 'rate_limited' })
    return
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    res.status(503).json({ ok: false, error: 'supabase_not_configured' })
    return
  }

  const body = parseRequestJsonRecord(req)
  const rawCode = typeof body.code === 'string' ? body.code : ''
  const code = rawCode.trim().toUpperCase().replace(/\s+/g, '')
  const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
  if (!code || !userId) {
    res.status(400).json({ ok: false })
    return
  }

  const countryId = typeof body.countryId === 'string' ? body.countryId : undefined
  const subscriptionActive = typeof body.subscriptionActive === 'boolean' ? body.subscriptionActive : undefined
  const plan = body.plan === null || typeof body.plan === 'string' ? (body.plan as string | null) : undefined
  const unlockedCategories = Array.isArray(body.unlockedCategories)
    ? body.unlockedCategories.filter((x): x is string => typeof x === 'string')
    : undefined

  const { data: row, error: selErr } = await supabase
    .from('rentadria_promo_codes')
    .select('id, record')
    .eq('code', code)
    .maybeSingle()

  if (selErr) {
    res.status(500).json({ ok: false })
    return
  }

  if (!row || typeof row.record !== 'object' || row.record === null) {
    res.status(200).json({ ok: true, skipped: true })
    return
  }

  const promoId = row.id as string
  const parsed = parsePromoRecordJson(row.record)
  if (!parsed) {
    res.status(500).json({ ok: false })
    return
  }

  const { data: existing } = await supabase
    .from('rentadria_promo_redemptions')
    .select('user_id')
    .eq('promo_id', promoId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    res.status(200).json({ ok: true, record: parsed, already: true })
    return
  }

  const v = validatePromoRecordOnServer(parsed, {
    userId,
    countryId,
    subscriptionActive,
    plan: plan ?? null,
    unlockedCategories,
  })
  if (v.ok === false) {
    res.status(400).json({ ok: false, reason: v.reason })
    return
  }

  const { error: insErr } = await supabase.from('rentadria_promo_redemptions').insert({
    promo_id: promoId,
    user_id: userId,
  })

  if (insErr) {
    if (insErr.code === '23505') {
      const { data: r2 } = await supabase.from('rentadria_promo_codes').select('record').eq('id', promoId).maybeSingle()
      const again = r2?.record ? parsePromoRecordJson(r2.record) : parsed
      res.status(200).json({ ok: true, record: again ?? parsed, already: true })
      return
    }
    res.status(500).json({ ok: false })
    return
  }

  const nextUses = parsed.uses + 1
  const nextUsesByCountry = { ...parsed.usesByCountry }
  if (countryId) {
    nextUsesByCountry[countryId] = (nextUsesByCountry[countryId] ?? 0) + 1
  }
  const nextRecord: PromoRecordShape = {
    ...parsed,
    uses: nextUses,
    usesByCountry: nextUsesByCountry,
  }

  const { error: upErr } = await supabase
    .from('rentadria_promo_codes')
    .update({
      record: nextRecord as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    })
    .eq('id', promoId)

  if (upErr) {
    await supabase.from('rentadria_promo_redemptions').delete().eq('promo_id', promoId).eq('user_id', userId)
    res.status(500).json({ ok: false })
    return
  }

  res.status(200).json({ ok: true, record: nextRecord })
}
