import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { addOneYearIsoFrom, registrationGetsFreePro } from '../server/lib/registrationPromo.js'
import { upsertRegisteredOwnerFromVerify } from '../server/lib/registeredOwnersDb.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { signOwnerSessionExchangeToken, verifyVerifyToken } from '../server/lib/verifyJwt.js'

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
  if (!rateLimit(`verify:${ip}`, 40, 60_000)) {
    send429(res)
    return
  }

  try {
    const body = parseRequestJsonRecord(req)
    const token = String(body.token ?? '').trim()
    if (!token) {
      res.status(400).json({ error: 'missing_token' })
      return
    }

    const payload = await verifyVerifyToken(token)
    let plan = payload.plan
    if (!['basic', 'pro', 'agency'].includes(plan)) plan = 'basic'

    const registeredAt = new Date().toISOString()
    const profileOut = await upsertRegisteredOwnerFromVerify({ ...payload, plan }, registeredAt)

    let subscriptionPlan = profileOut?.plan ?? null
    let subscriptionActive = profileOut?.subscriptionActive ?? false
    let validUntilOut = profileOut?.validUntil ?? ''
    const registeredAtOut = profileOut?.registeredAt ?? registeredAt

    if (!profileOut) {
      const regDate = new Date(registeredAt)
      if (registrationGetsFreePro(regDate)) {
        subscriptionPlan = 'pro'
        subscriptionActive = true
        validUntilOut = addOneYearIsoFrom(regDate)
      }
    }

    let ownerSessionExchange: string | undefined
    try {
      ownerSessionExchange = await signOwnerSessionExchangeToken(payload.email)
    } catch {
      /* JWT_SECRET nedostaje ili je prekratak — preskoči razmjenu sesije */
    }

    res.status(200).json({
      ok: true,
      email: payload.email,
      name: payload.name,
      plan,
      passwordHash: payload.passwordHash,
      phone: payload.phone,
      countryId: payload.countryId,
      promoCode: payload.promoCode,
      subscriptionPlan,
      subscriptionActive,
      validUntil: validUntilOut,
      basicCategoryChoice: profileOut?.basicCategoryChoice ?? null,
      registeredAt: registeredAtOut,
      ownerSessionExchange,
    })
  } catch (e) {
    const name = e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : ''
    const msg = e instanceof Error ? e.message : 'invalid_token'
    let code = 'invalid_token'
    if (name === 'ERR_JWT_EXPIRED' || /expired/i.test(msg)) {
      code = 'token_expired'
    } else if (/JWT_SECRET|jwt/i.test(msg) && process.env.VERCEL_ENV === 'production') {
      code = 'server_misconfigured'
    }
    res.status(400).json({ error: code })
  }
}
