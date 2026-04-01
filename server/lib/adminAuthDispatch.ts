/**
 * Server-only admin login: credentials and JWT never ship in the client bundle.
 * Env: ADMIN_EMAIL, ADMIN_PASSWORD (min 12 chars), ADMIN_SESSION_SECRET (min 32 chars).
 */
import { SignJWT, jwtVerify } from 'jose'
import { timingSafeEqual } from 'node:crypto'
import { clientIp, rateLimitIp } from './rateLimitIp.js'

export const ADMIN_COOKIE_NAME = 'ra_admin_session'

const MIN_PW = 12
const MIN_SECRET = 32

function getJwtSecret(): Uint8Array {
  const s = process.env.ADMIN_SESSION_SECRET?.trim()
  if (s && s.length >= MIN_SECRET) return new TextEncoder().encode(s)
  if (process.env.VERCEL_ENV !== 'production' && process.env.NODE_ENV !== 'production') {
    return new TextEncoder().encode('dev-admin-session-secret-min-32-chars!!')
  }
  throw new Error('ADMIN_SESSION_SECRET must be set (min 32 chars)')
}

/** Production requires ADMIN_EMAIL; dev falls back so local .env can omit it. */
function adminEmailExpected(): string | null {
  const raw = process.env.ADMIN_EMAIL?.trim()
  if (raw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return raw.toLowerCase()
  const isDev = process.env.VERCEL_ENV !== 'production' && process.env.NODE_ENV !== 'production'
  if (isDev) return 'info@rentadria.com'
  return null
}

function adminPasswordExpected(): string | null {
  const p = process.env.ADMIN_PASSWORD?.trim()
  return p && p.length >= MIN_PW ? p : null
}

function safeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ba.length !== bb.length) return false
  try {
    return timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}

export function verifyAdminCredentials(email: string, password: string): boolean {
  const expectedPw = adminPasswordExpected()
  const expectedEm = adminEmailExpected()
  if (!expectedPw || !expectedEm) return false
  const em = email.trim().toLowerCase()
  return em === expectedEm && safeEqualStr(password, expectedPw)
}

export async function signAdminJwt(email: string): Promise<string> {
  const secret = getJwtSecret()
  const em = email.trim().toLowerCase()
  return new SignJWT({ role: 'admin', email: em })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('admin')
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)
}

export async function verifyAdminJwt(token: string): Promise<boolean> {
  try {
    const secret = getJwtSecret()
    const { payload } = await jwtVerify(token, secret)
    return payload.role === 'admin' && typeof payload.email === 'string'
  } catch {
    return false
  }
}

function parseCookie(cookieHeader: string | undefined, name: string): string | undefined {
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

function buildSetCookie(value: string, maxAgeSec: number, secure: boolean): string {
  const parts = [
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${String(maxAgeSec)}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

function clearCookieHeader(secure: boolean): string {
  const parts = [`${ADMIN_COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export type AdminAuthDispatchInput = {
  method: string
  cookieHeader: string | undefined
  body: Record<string, unknown>
  /** Vercel / Node request IP */
  ip: string
  /** Production-ish: set Secure on cookies */
  secureCookie: boolean
}

export type AdminAuthDispatchResult = {
  status: number
  json: Record<string, unknown>
  setCookie?: string
}

/** Core handler: login (POST), verify (GET), logout (POST action). */
export async function adminAuthDispatch(input: AdminAuthDispatchInput): Promise<AdminAuthDispatchResult> {
  const { method, cookieHeader, body, ip, secureCookie } = input

  if (!rateLimitIp(ip, 40, 60_000)) {
    return { status: 429, json: { ok: false, error: 'rate_limited' } }
  }

  try {
    getJwtSecret()
  } catch {
    return { status: 503, json: { ok: false, error: 'admin_auth_not_configured' } }
  }

  if (method === 'GET') {
    const tok = parseCookie(cookieHeader, ADMIN_COOKIE_NAME)
    if (!tok) return { status: 401, json: { ok: false } }
    const ok = await verifyAdminJwt(tok)
    return ok ? { status: 200, json: { ok: true } } : { status: 401, json: { ok: false } }
  }

  if (method === 'POST') {
    const action = typeof body.action === 'string' ? body.action : ''
    if (action === 'logout') {
      return {
        status: 200,
        json: { ok: true },
        setCookie: clearCookieHeader(secureCookie),
      }
    }

    const email = typeof body.email === 'string' ? body.email : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!email.trim() || !password) {
      return { status: 400, json: { ok: false, error: 'invalid_body' } }
    }

    if (!adminPasswordExpected()) {
      return { status: 503, json: { ok: false, error: 'admin_auth_not_configured' } }
    }

    if (!verifyAdminCredentials(email, password)) {
      return { status: 401, json: { ok: false, error: 'unauthorized' } }
    }

    const token = await signAdminJwt(email)
    return {
      status: 200,
      json: { ok: true },
      setCookie: buildSetCookie(token, 7 * 24 * 60 * 60, secureCookie),
    }
  }

  return { status: 405, json: { ok: false, error: 'method_not_allowed' } }
}

/** For Vercel handler: parse IP from request */
export function adminAuthIpFromVercel(req: { headers: Record<string, string | string[] | undefined> }): string {
  return clientIp(req)
}

/** Provjera HttpOnly admin kolačića (za /api/admin-promo itd.). */
export async function verifyAdminCookie(cookieHeader: string | undefined): Promise<boolean> {
  const tok = parseCookie(cookieHeader, ADMIN_COOKIE_NAME)
  if (!tok) return false
  return verifyAdminJwt(tok)
}
