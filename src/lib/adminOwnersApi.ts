import type { OwnerProfile } from '../utils/ownerSession'

const JSON_HDR = { 'Content-Type': 'application/json' } as const

/** Profili vlasnika za admin (Supabase, bez soft‑deleted). */
export async function fetchAdminOwnersProfiles(): Promise<OwnerProfile[] | null> {
  try {
    const r = await fetch('/api/admin-owners', { credentials: 'include' })
    if (!r.ok) return null
    const j = (await r.json()) as { ok?: boolean; owners?: Array<OwnerProfile & { adminMeta?: unknown }> }
    if (!j.ok || !Array.isArray(j.owners)) return null
    return j.owners.map((o) => {
      const { adminMeta, ...rest } = o
      void adminMeta
      return rest as OwnerProfile
    })
  } catch {
    return null
  }
}

export async function softDeleteOwnerOnServer(userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch('/api/admin-deleted-owners', {
      method: 'POST',
      headers: JSON_HDR,
      credentials: 'include',
      body: JSON.stringify({ action: 'delete', userId }),
    })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    if (!r.ok || !j.ok) return { ok: false, error: j.error ?? String(r.status) }
    return { ok: true }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function sendAdminOwnerEmail(input: {
  toEmail: string
  toName: string
  subject: string
  message: string
}): Promise<boolean> {
  try {
    const r = await fetch('/api/admin-send-owner-email', {
      method: 'POST',
      headers: JSON_HDR,
      credentials: 'include',
      body: JSON.stringify({
        toEmail: input.toEmail,
        toName: input.toName,
        subject: input.subject,
        message: input.message,
      }),
    })
    return r.ok
  } catch {
    return false
  }
}

/** Ažuriranje vlasnika (isti endpoint kao modal na Vlasnicima). */
export async function postAdminOwnerUpdate(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch('/api/admin-owner-update', {
      method: 'POST',
      headers: JSON_HDR,
      credentials: 'include',
      body: JSON.stringify(body),
    })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    if (!r.ok || j.ok === false) return { ok: false, error: j.error ?? String(r.status) }
    return { ok: true }
  } catch {
    return { ok: false, error: 'network' }
  }
}
