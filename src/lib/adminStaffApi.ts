import type { StaffMember, StaffRole } from '../utils/adminStaffStore'

export async function fetchAdminStaffList(): Promise<StaffMember[] | null> {
  try {
    const r = await fetch('/api/admin-staff', { credentials: 'include' })
    if (r.status === 503) return null
    if (!r.ok) return null
    const j = (await r.json()) as { ok?: boolean; rows?: StaffMember[] }
    if (!j.ok || !Array.isArray(j.rows)) return null
    return j.rows
  } catch {
    return null
  }
}

export async function upsertAdminStaffToServer(staff: {
  id: string
  name: string
  email: string
  passwordHash: string
  role: StaffRole
  blocked: boolean
  permissions: string[]
}): Promise<boolean> {
  try {
    const r = await fetch('/api/admin-staff', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff }),
    })
    return r.ok
  } catch {
    return false
  }
}

export async function deleteAdminStaffOnServer(id: string): Promise<boolean> {
  try {
    const r = await fetch(`/api/admin-staff?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    return r.ok
  } catch {
    return false
  }
}

