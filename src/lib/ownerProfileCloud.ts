import { ownerProfileFromCloudPayload, saveOwnerProfile, type OwnerProfile } from '../utils/ownerSession'
import { setAdminOwnerMeta } from '../utils/adminOwnerMeta'

const JSON_HDR = { 'Content-Type': 'application/json' } as const

function profileToPatchBody(p: OwnerProfile): Record<string, unknown> {
  const avatarUrl =
    p && typeof p === 'object' && 'avatarUrl' in (p as Record<string, unknown>)
      ? (p as Record<string, unknown>).avatarUrl
      : null
  return {
    displayName: p.displayName,
    phone: p.phone ?? null,
    countryId: p.countryId ?? null,
    avatarUrl: typeof avatarUrl === 'string' ? avatarUrl : null,
    basicCategoryChoice: p.basicCategoryChoice ?? null,
    promoCategoryScope: p.promoCategoryScope ?? null,
  }
}

export type OwnerProfilePasswordChangePatch = {
  oldPasswordHash: string
  newPasswordHash: string
}

/** Učitaj profil vlasnika iz Supabase-a u localStorage (uz aktivnu owner sesiju). */
export async function pullOwnerProfileFromCloud(expectedUserId: string): Promise<boolean> {
  const uid = expectedUserId.trim().toLowerCase()
  try {
    const r = await fetch('/api/owner-profile', { credentials: 'include' })
    const j = (await r.json()) as { ok?: boolean; profile?: Record<string, unknown> }
    if (!r.ok || !j.ok || !j.profile || typeof j.profile !== 'object') return false
    const parsed = ownerProfileFromCloudPayload(j.profile)
    if (!parsed || parsed.userId.trim().toLowerCase() !== uid) return false
    const raw = j.profile as Record<string, unknown>
    const adminMeta = raw.adminMeta
    if (adminMeta && typeof adminMeta === 'object' && !Array.isArray(adminMeta)) {
      const am = adminMeta as Record<string, unknown>
      setAdminOwnerMeta(uid, {
        xmlImportUrl: undefined,
        xmlFieldMapping: undefined,
        extraListingsAcc: Math.max(0, Number(am.extraListingsAcc) || 0),
        extraListingsCar: Math.max(0, Number(am.extraListingsCar) || 0),
        extraListingsMoto: Math.max(0, Number(am.extraListingsMoto) || 0),
        extraCatAcc: am.extraCatAcc === true,
        extraCatCar: am.extraCatCar === true,
        extraCatMoto: am.extraCatMoto === true,
        blocked: am.blocked === true,
        planOverride: am.planOverride === true,
      })
    }
    saveOwnerProfile(parsed)
    return true
  } catch {
    return false
  }
}

/** Snimi trenutni profil na server (PATCH). */
export async function pushOwnerProfileToCloud(profile: OwnerProfile): Promise<boolean> {
  try {
    const r = await fetch('/api/owner-profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: JSON_HDR,
      body: JSON.stringify(profileToPatchBody(profile)),
    })
    if (!r.ok) return false
    const j = (await r.json()) as { ok?: boolean; profile?: Record<string, unknown> }
    if (!j.ok || !j.profile || typeof j.profile !== 'object') return false
    const parsed = ownerProfileFromCloudPayload(j.profile)
    if (!parsed) return false
    saveOwnerProfile(parsed)
    return true
  } catch {
    return false
  }
}

/** Promjena lozinke: server verifikuje staru pa snima novu. */
export async function changeOwnerPasswordOnCloud(patch: OwnerProfilePasswordChangePatch): Promise<
  | { ok: true }
  | { ok: false; reason: 'owner_backend_unavailable' | 'old_password_required' | 'bad_password' | 'invalid_new_password' | 'unknown' }
> {
  try {
    const r = await fetch('/api/owner-profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: JSON_HDR,
      body: JSON.stringify({
        oldPasswordHash: patch.oldPasswordHash,
        newPasswordHash: patch.newPasswordHash,
      }),
    })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    if (!r.ok || !j.ok) {
      const e = String(j.error ?? '')
      if (e === 'owner_backend_unavailable') return { ok: false, reason: 'owner_backend_unavailable' }
      if (e === 'old_password_required') return { ok: false, reason: 'old_password_required' }
      if (e === 'bad_password') return { ok: false, reason: 'bad_password' }
      if (e === 'invalid_new_password') return { ok: false, reason: 'invalid_new_password' }
      return { ok: false, reason: 'unknown' }
    }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'owner_backend_unavailable' }
  }
}

export type OwnerNotificationPayload = {
  id: string
  kind: string
  title: string
  body: string
  createdAt: string
  readAt: string | null
}

export async function pullOwnerNotificationsFromCloud(limit = 50): Promise<OwnerNotificationPayload[] | null> {
  try {
    const q = new URLSearchParams({ limit: String(limit) })
    const r = await fetch(`/api/owner-notifications?${q}`, { credentials: 'include' })
    const j = (await r.json()) as { ok?: boolean; notifications?: OwnerNotificationPayload[] }
    if (!r.ok || !j.ok || !Array.isArray(j.notifications)) return null
    return j.notifications
  } catch {
    return null
  }
}

export async function markOwnerNotificationReadOnCloud(id: string): Promise<boolean> {
  try {
    const r = await fetch('/api/owner-notifications', {
      method: 'POST',
      credentials: 'include',
      headers: JSON_HDR,
      body: JSON.stringify({ id }),
    })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean }
    return r.ok && j.ok === true
  } catch {
    return false
  }
}
