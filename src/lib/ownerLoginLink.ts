import type { OwnerProfile } from '../utils/ownerSession'

export async function requestOwnerLoginLink(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const r = await fetch('/api/owner-login-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    if (!r.ok || j.ok !== true) return { ok: false, error: j.error || 'request_failed' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'request_failed' }
  }
}

export async function verifyOwnerLoginLink(
  token: string,
): Promise<{ ok: true; profile: OwnerProfile } | { ok: false; error: string }> {
  try {
    const r = await fetch('/api/owner-login-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    })
    const j = (await r.json().catch(() => ({}))) as {
      ok?: boolean
      profile?: OwnerProfile
      error?: string
    }
    if (r.ok && j.ok && j.profile) return { ok: true, profile: j.profile }
    return { ok: false, error: j.error || 'verify_failed' }
  } catch {
    return { ok: false, error: 'verify_failed' }
  }
}

