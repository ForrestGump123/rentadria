import { getSupabaseAdmin } from './supabaseAdmin.js'

export type StaffRole = 'agent' | 'subadmin'

export type StaffMemberRecord = {
  id: string
  name: string
  email: string
  passwordHash: string
  role: StaffRole
  blocked: boolean
  permissions: string[]
  createdAt: string
  updatedAt: string
}

function parseRole(raw: unknown): StaffRole {
  return raw === 'subadmin' ? 'subadmin' : 'agent'
}

function parsePermissions(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
  if (typeof raw === 'string') return [raw]
  return []
}

function rowToApi(r: Record<string, unknown>): StaffMemberRecord | null {
  const id = typeof r.id === 'string' ? r.id : ''
  const email = typeof r.email === 'string' ? r.email.trim().toLowerCase() : ''
  const name = typeof r.name === 'string' ? r.name.trim() : ''
  const ph = typeof r.password_hash === 'string' ? r.password_hash.trim().toLowerCase() : ''
  if (!id || !email || !name || !ph) return null
  const createdAt = typeof r.created_at === 'string' ? r.created_at : new Date().toISOString()
  const updatedAt = typeof r.updated_at === 'string' ? r.updated_at : createdAt
  return {
    id,
    email,
    name,
    passwordHash: ph,
    role: parseRole(r.role),
    blocked: Boolean(r.blocked),
    permissions: parsePermissions(r.permissions),
    createdAt,
    updatedAt,
  }
}

export async function listStaffMembers(): Promise<StaffMemberRecord[] | null> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('rentadria_staff_members')
    .select('*')
    .order('created_at', { ascending: false })
  if (error || !Array.isArray(data)) return []
  const out: StaffMemberRecord[] = []
  for (const raw of data) {
    if (raw && typeof raw === 'object') {
      const m = rowToApi(raw as Record<string, unknown>)
      if (m) out.push(m)
    }
  }
  return out
}

export async function upsertStaffMember(input: {
  id: string
  name: string
  email: string
  passwordHash: string
  role: StaffRole
  blocked: boolean
  permissions: string[]
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return { ok: false, error: 'no_backend' }
  const row = {
    id: input.id,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    password_hash: input.passwordHash.trim().toLowerCase(),
    role: input.role,
    blocked: Boolean(input.blocked),
    permissions: input.permissions,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('rentadria_staff_members').upsert(row, { onConflict: 'id' })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function deleteStaffMember(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return false
  const { error } = await supabase.from('rentadria_staff_members').delete().eq('id', id)
  return !error
}

