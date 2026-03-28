/** Session-only admin gate (demo). Replace with server-side roles in production. */
const ADMIN_SS = 'rentadria_admin_session'

export function isAdminSession(): boolean {
  try {
    return sessionStorage.getItem(ADMIN_SS) === '1'
  } catch {
    return false
  }
}

export function setAdminSession(v: boolean): void {
  try {
    if (v) sessionStorage.setItem(ADMIN_SS, '1')
    else sessionStorage.removeItem(ADMIN_SS)
  } catch {
    /* ignore */
  }
}

/** Demo default; override with VITE_ADMIN_PASSWORD in `.env` for production */
const DEFAULT_ADMIN_PASSWORD = 'MilanZivic1212$'

export function verifyAdminPassword(pw: string): boolean {
  const expected = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined
  const pass = (expected && expected.length > 0 ? expected : DEFAULT_ADMIN_PASSWORD) as string
  return pw === pass
}

/** Admin login email (Auth modal + admin gate) */
export const ADMIN_LOGIN_EMAIL = 'info@rentadria.com'

/** Email + password (both must match). */
export function verifyAdminLogin(email: string, pw: string): boolean {
  const em = email.trim().toLowerCase()
  return em === ADMIN_LOGIN_EMAIL.toLowerCase() && verifyAdminPassword(pw)
}
