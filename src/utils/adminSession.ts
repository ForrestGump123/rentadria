/** Session hint for admin UI (HttpOnly cookie is the real check; see /api/admin-auth). */
import { fetchAdminVerify } from '../lib/adminAuthApi'

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
  try {
    window.dispatchEvent(new CustomEvent('rentadria-admin-auth'))
  } catch {
    /* ignore */
  }
}

/** Sync client hint with server cookie (e.g. after deploy or cleared cookie). */
export async function syncAdminSessionWithServer(): Promise<void> {
  const hinted = isAdminSession()
  if (!hinted) return
  const ok = await fetchAdminVerify()
  if (!ok) setAdminSession(false)
}
