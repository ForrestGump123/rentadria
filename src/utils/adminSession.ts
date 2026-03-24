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

/** Set `VITE_ADMIN_PASSWORD` in `.env` for production; demo fallback for local dev only */
export function verifyAdminPassword(pw: string): boolean {
  const expected = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined
  const pass = (expected && expected.length > 0 ? expected : 'rentadria-admin') as string
  return pw === pass
}
