/**
 * HttpOnly cookie session for owners (same-origin API calls after login / verify exchange).
 * Env: OWNER_SESSION_SECRET (min 32) or JWT_SECRET (min 32) as fallback.
 */
import { SignJWT, jwtVerify } from 'jose'

export const OWNER_COOKIE_NAME = 'ra_owner_session'

function getOwnerSessionSecret(): Uint8Array {
  const a = process.env.OWNER_SESSION_SECRET?.trim()
  const b = process.env.JWT_SECRET?.trim()
  const s = (a && a.length >= 32 ? a : '') || (b && b.length >= 32 ? b : '')
  if (s) return new TextEncoder().encode(s)
  if (process.env.VERCEL_ENV !== 'production' && process.env.NODE_ENV !== 'production') {
    return new TextEncoder().encode('dev-owner-session-secret-min-32-chars!!')
  }
  throw new Error('OWNER_SESSION_SECRET or JWT_SECRET (min 32 chars) required for owner session')
}

export async function signOwnerSessionJwt(userId: string): Promise<string> {
  const secret = getOwnerSessionSecret()
  const sub = userId.trim().toLowerCase()
  return new SignJWT({ role: 'owner' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)
}

/** Returns owner user_id (email lower) or null. */
export async function verifyOwnerSessionJwt(token: string): Promise<string | null> {
  try {
    const secret = getOwnerSessionSecret()
    const { payload } = await jwtVerify(token, secret)
    if (payload.role !== 'owner' || typeof payload.sub !== 'string' || !payload.sub.trim()) return null
    return payload.sub.trim().toLowerCase()
  } catch {
    return null
  }
}

export function parseCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const k = part.slice(0, idx).trim()
    if (k !== name) continue
    const v = part.slice(idx + 1).trim()
    try {
      return decodeURIComponent(v)
    } catch {
      return v
    }
  }
  return undefined
}

export function ownerSessionCookieHeader(value: string, maxAgeSec: number, secure: boolean): string {
  const parts = [
    `${OWNER_COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${String(maxAgeSec)}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function clearOwnerSessionCookieHeader(secure: boolean): string {
  const parts = [`${OWNER_COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export async function ownerUserIdFromCookie(cookieHeader: string | undefined): Promise<string | null> {
  const tok = parseCookie(cookieHeader, OWNER_COOKIE_NAME)
  if (!tok) return null
  return verifyOwnerSessionJwt(tok)
}
