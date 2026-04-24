import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuthIpFromVercel, verifyAdminCookie } from '../server/lib/adminAuthDispatch.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { rateLimitIp } from '../server/lib/rateLimitIp.js'
import { deleteStaffMember, listStaffMembers, upsertStaffMember } from '../server/lib/staffMembersDb.js'

/**
 * Admin staff CRUD (Supabase).
 * GET list, POST upsert, DELETE ?id=
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const ip = adminAuthIpFromVercel(req)
  if (!rateLimitIp(ip, 60, 60_000)) {
    res.status(429).json({ ok: false, error: 'rate_limited' })
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const adminOk = await verifyAdminCookie(cookieHeader)
  if (!adminOk) {
    res.status(401).json({ ok: false })
    return
  }

  if (req.method === 'GET') {
    const rows = await listStaffMembers()
    if (rows === null) {
      res.status(503).json({ ok: false, error: 'supabase_not_configured' })
      return
    }
    res.status(200).json({ ok: true, rows })
    return
  }

  if (req.method === 'POST') {
    const body = parseRequestJsonRecord(req)
    const raw = body.staff
    if (!raw || typeof raw !== 'object') {
      res.status(400).json({ ok: false, error: 'invalid_body' })
      return
    }
    const o = raw as Record<string, unknown>
    const id = typeof o.id === 'string' ? o.id : ''
    const name = typeof o.name === 'string' ? o.name : ''
    const email = typeof o.email === 'string' ? o.email : ''
    const passwordHash = typeof o.passwordHash === 'string' ? o.passwordHash : ''
    const role = o.role === 'subadmin' ? 'subadmin' : 'agent'
    const blocked = Boolean(o.blocked)
    const permissions = Array.isArray(o.permissions) ? o.permissions.filter((x): x is string => typeof x === 'string') : []
    if (!id || !name.trim() || !email.trim() || !passwordHash.trim()) {
      res.status(400).json({ ok: false, error: 'invalid_staff' })
      return
    }
    const r = await upsertStaffMember({
      id,
      name,
      email,
      passwordHash,
      role,
      blocked,
      permissions,
    })
    if (!r.ok) {
      res.status(500).json({ ok: false })
      return
    }
    res.status(200).json({ ok: true })
    return
  }

  if (req.method === 'DELETE') {
    const q = req.query.id
    const id = typeof q === 'string' ? q : Array.isArray(q) ? q[0] : ''
    if (!id) {
      res.status(400).json({ ok: false })
      return
    }
    const ok = await deleteStaffMember(id)
    res.status(ok ? 200 : 500).json({ ok })
    return
  }

  res.status(405).json({ ok: false })
}

