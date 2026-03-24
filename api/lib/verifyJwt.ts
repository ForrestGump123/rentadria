import { SignJWT, jwtVerify } from 'jose'

export type VerifyTokenPayload = {
  email: string
  name: string
  plan: string
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
  return new SignJWT({ ...payload })
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
  return { email: email.toLowerCase(), name, plan }
}
