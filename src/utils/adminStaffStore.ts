export type StaffRole = 'agent' | 'subadmin'

export type StaffMember = {
  id: string
  name: string
  email: string
  /** SHA-256 hex — u produkciji server-side */
  passwordHash?: string
  role: StaffRole
  blocked: boolean
  permissions?: string[]
  createdAt: string
  updatedAt?: string
}

// Storage is server-backed; keep this file as shared types only.
