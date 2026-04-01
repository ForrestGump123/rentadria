/**
 * Admin login uses POST /api/admin-auth (server-only credentials + HttpOnly cookie).
 * Never import passwords or ADMIN_EMAIL into the client bundle.
 */
export async function fetchAdminLogin(email: string, password: string): Promise<boolean> {
  try {
    const r = await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: email.trim(), password }),
    })
    if (!r.ok) return false
    const j = (await r.json()) as { ok?: boolean }
    return j.ok === true
  } catch {
    return false
  }
}

export async function fetchAdminVerify(): Promise<boolean> {
  try {
    const r = await fetch('/api/admin-auth', { credentials: 'include' })
    if (!r.ok) return false
    const j = (await r.json()) as { ok?: boolean }
    return j.ok === true
  } catch {
    return false
  }
}

export async function fetchAdminLogout(): Promise<void> {
  try {
    await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'logout' }),
    })
  } catch {
    /* ignore */
  }
}
