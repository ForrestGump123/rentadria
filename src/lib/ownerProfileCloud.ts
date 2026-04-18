import { ownerProfileFromCloudPayload, saveOwnerProfile, type OwnerProfile } from '../utils/ownerSession'

const JSON_HDR = { 'Content-Type': 'application/json' } as const

function profileToPatchBody(p: OwnerProfile): Record<string, unknown> {
  return {
    displayName: p.displayName,
    phone: p.phone ?? null,
    countryId: p.countryId ?? null,
    avatarDataUrl: p.avatarDataUrl ?? null,
    basicCategoryChoice: p.basicCategoryChoice ?? null,
    promoCategoryScope: p.promoCategoryScope ?? null,
    passwordHash: typeof p.passwordHash === 'string' ? p.passwordHash : undefined,
  }
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
