import type { OwnerProfile } from '../utils/ownerSession'

/** Prijava vlasnika preko servera (Supabase) kad lokalni profil ne postoji na ovom uređaju. */
export async function fetchOwnerRemoteLogin(email: string, password: string): Promise<OwnerProfile | null> {
  try {
    const r = await fetch('/api/owner-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    })
    if (!r.ok) return null
    const j = (await r.json()) as { ok?: boolean; profile?: OwnerProfile }
    if (!j.ok || !j.profile || typeof j.profile.userId !== 'string') return null
    return j.profile
  } catch {
    return null
  }
}
