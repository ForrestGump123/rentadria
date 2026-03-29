export type StaffRole = 'agent' | 'subadmin'

export type StaffMember = {
  id: string
  name: string
  email: string
  /** SHA-256 hex — u produkciji server-side */
  passwordHash?: string
  role: StaffRole
  blocked: boolean
  createdAt: string
}

const KEY = 'rentadria_admin_staff_v1'

function load(): StaffMember[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const a = JSON.parse(raw) as unknown
    return Array.isArray(a) ? a : []
  } catch {
    return []
  }
}

function save(rows: StaffMember[]) {
  localStorage.setItem(KEY, JSON.stringify(rows))
  try {
    window.dispatchEvent(new Event('rentadria-admin-staff-updated'))
  } catch {
    /* ignore */
  }
}

export function listStaff(): StaffMember[] {
  return load().slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function upsertStaff(
  row: Omit<StaffMember, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
): StaffMember {
  const list = load()
  const id = row.id ?? `staff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()
  const existing = list.find((x) => x.id === id)
  const createdAt = existing?.createdAt ?? row.createdAt ?? now
  const next: StaffMember = {
    id,
    name: row.name.trim(),
    email: row.email.trim().toLowerCase(),
    passwordHash: row.passwordHash,
    role: row.role,
    blocked: row.blocked,
    createdAt,
  }
  const i = list.findIndex((x) => x.id === id)
  if (i >= 0) list[i] = next
  else list.unshift(next)
  save(list)
  return next
}

export function toggleStaffBlock(id: string): void {
  const list = load()
  const i = list.findIndex((x) => x.id === id)
  if (i < 0) return
  list[i] = { ...list[i]!, blocked: !list[i]!.blocked }
  save(list)
}
