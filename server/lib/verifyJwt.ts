import { SignJWT, jwtVerify } from 'jose'

const COUNTRY_IDS = new Set(['al', 'ba', 'me', 'hr', 'it', 'rs', 'es'])

export type VerifyTokenPayload = {
  email: string
  name: string
  plan: string
  /** SHA-256 heks vlasničke lozinke (isti format kao u `ownerSession`). */
  passwordHash?: string
  phone?: string
  countryId?: string
  promoCode?: string
}

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET
  if (s && s.length >= 16) return new TextEncoder().encode(s)
  if (process.env.VERCEL_ENV !== 'production' && process.env.NODE_ENV !== 'production') {
    return new TextEncoder().encode('dev-only-jwt-secret-min-16chars!')
  }
  throw new Error('JWT_SECRET must be set (min 16 chars)')
}

export async function signVerifyToken(payload: VerifyTokenPayload): Promise<string> {
  const secret = getSecret()
  const claims: Record<string, unknown> = {
    email: payload.email,
    name: payload.name,
    plan: payload.plan,
  }
  if (payload.passwordHash) claims.passwordHash = payload.passwordHash
  if (payload.phone) claims.phone = payload.phone
  if (payload.countryId) claims.countryId = payload.countryId
  if (payload.promoCode) claims.promoCode = payload.promoCode
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('48h')
    .sign(secret)
}

export async function verifyVerifyToken(token: string): Promise<VerifyTokenPayload> {
  const secret = getSecret()
  const { payload } = await jwtVerify(token, secret)
  const email = typeof payload.email === 'string' ? payload.email : ''
  const name = typeof payload.name === 'string' ? payload.name : ''
  const plan = typeof payload.plan === 'string' ? payload.plan : 'basic'
  if (!email) throw new Error('invalid_token')
  const em = email.toLowerCase()
  let passwordHash: string | undefined
  if (typeof payload.passwordHash === 'string') {
    const h = payload.passwordHash.trim().toLowerCase()
    if (/^[a-f0-9]{64}$/.test(h)) passwordHash = h
  }
  const phone =
    typeof payload.phone === 'string' && payload.phone.trim()
      ? payload.phone.trim().slice(0, 80)
      : undefined
  let countryId: string | undefined
  if (typeof payload.countryId === 'string') {
    const c = payload.countryId.trim().toLowerCase()
    if (COUNTRY_IDS.has(c)) countryId = c
  }
  const promoCode =
    typeof payload.promoCode === 'string' && payload.promoCode.trim()
      ? payload.promoCode.trim().slice(0, 64)
      : undefined
  return { email: em, name, plan, passwordHash, phone, countryId, promoCode }
}

/** Kratkotrajan token nakon verify-email za razmjenu u HttpOnly owner sesiju (bez ponovnog unosa lozinke). */
export async function signOwnerSessionExchangeToken(email: string): Promise<string> {
  const secret = getSecret()
  const em = email.trim().toLowerCase()
  return new SignJWT({ typ: 'owner_sess_ex' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(em)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret)
}

/** Vraća email (sub) ili null. */
export async function verifyOwnerSessionExchangeToken(token: string): Promise<string | null> {
  try {
    const secret = getSecret()
    const { payload } = await jwtVerify(token, secret)
    if (payload.typ !== 'owner_sess_ex' || typeof payload.sub !== 'string' || !payload.sub.trim()) return null
    return payload.sub.trim().toLowerCase()
  } catch {
    return null
  }
}
