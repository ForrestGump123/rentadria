import type { OwnerProfile } from '../utils/ownerSession'

export type OwnerRemoteLoginResult =
  | { ok: true; profile: OwnerProfile }
  | { ok: false; error: 'unauthorized' | 'no_password_stored' | 'backend_unavailable' }

/** Prijava vlasnika preko servera (Supabase) kad lokalni profil ne postoji na ovom uređaju. */
export async function fetchOwnerRemoteLogin(email: string, password: string): Promise<OwnerRemoteLoginResult> {
  try {
    const r = await fetch('/api/owner-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    })
    let j: { ok?: boolean; profile?: OwnerProfile; error?: string }
    try {
      j = (await r.json()) as typeof j
    } catch {
      return { ok: false, error: 'unauthorized' }
    }
    if (r.ok && j.ok && j.profile && typeof j.profile.userId === 'string') {
      return { ok: true, profile: j.profile }
    }
    if (r.status === 503 && j.error === 'owner_backend_unavailable') {
      return { ok: false, error: 'backend_unavailable' }
    }
    if (r.status === 401 && j.error === 'no_password_stored') {
      return { ok: false, error: 'no_password_stored' }
    }
    return { ok: false, error: 'unauthorized' }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}
