import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { ownerUserIdFromCookie } from '../server/lib/ownerSessionAuth.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import {
  getRegisteredOwnerProfile,
  patchRegisteredOwnerSelf,
  type OwnerSelfProfilePatch,
  type RegisteredOwnerApiRow,
} from '../server/lib/registeredOwnersDb.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'

const VALID_CAT = new Set(['accommodation', 'car', 'motorcycle'])

function jsonProfile(row: RegisteredOwnerApiRow) {
  return {
    userId: row.userId,
    email: row.email,
    displayName: row.displayName,
    phone: row.phone ?? null,
    countryId: row.countryId ?? null,
    passwordHash: row.passwordHash ?? null,
    registeredAt: row.registeredAt,
    validUntil: row.validUntil,
    plan: row.plan,
    subscriptionActive: row.subscriptionActive,
    basicCategoryChoice: row.basicCategoryChoice ?? null,
    avatarDataUrl: row.avatarDataUrl ?? null,
    promoCategoryScope: row.promoCategoryScope ?? null,
  }
}

function parsePatch(body: Record<string, unknown>): OwnerSelfProfilePatch | null {
  const patch: OwnerSelfProfilePatch = {}
  let any = false

  if (typeof body.displayName === 'string') {
    patch.displayName = body.displayName
    any = true
  }
  if (body.phone === null) {
    patch.phone = null
    any = true
  } else if (typeof body.phone === 'string') {
    patch.phone = body.phone
    any = true
  }
  if (body.countryId === null) {
    patch.countryId = null
    any = true
  } else if (typeof body.countryId === 'string') {
    patch.countryId = body.countryId
    any = true
  }
  if (body.avatarDataUrl === null) {
    patch.avatarDataUrl = null
    any = true
  } else if (typeof body.avatarDataUrl === 'string') {
    patch.avatarDataUrl = body.avatarDataUrl === '' ? null : body.avatarDataUrl
    any = true
  }
  if (body.basicCategoryChoice === null || typeof body.basicCategoryChoice === 'string') {
    const c = body.basicCategoryChoice
    if (c === null) {
      patch.basicCategoryChoice = null
      any = true
    } else if (c === 'accommodation' || c === 'car' || c === 'motorcycle') {
      patch.basicCategoryChoice = c
      any = true
    } else {
      return null
    }
  }
  if (body.promoCategoryScope === null) {
    patch.promoCategoryScope = null
    any = true
  } else if (Array.isArray(body.promoCategoryScope)) {
    const out: ('accommodation' | 'car' | 'motorcycle')[] = []
    for (const x of body.promoCategoryScope) {
      if (typeof x === 'string' && VALID_CAT.has(x)) out.push(x as 'accommodation' | 'car' | 'motorcycle')
    }
    patch.promoCategoryScope = out.length > 0 ? out : null
    any = true
  }
  if (typeof body.passwordHash === 'string') {
    patch.passwordHash = body.passwordHash.trim().toLowerCase()
    any = true
  }

  return any ? patch : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`owner-profile:${ip}`, 60, 60_000)) {
    send429(res)
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const ownerUid = await ownerUserIdFromCookie(cookieHeader)
  if (!ownerUid) {
    res.status(401).json({ ok: false, error: 'owner_auth_required' })
    return
  }

  try {
    if (req.method === 'GET') {
      const row = await getRegisteredOwnerProfile(ownerUid)
      if (!row) {
        res.status(503).json({ ok: false, error: 'owner_backend_unavailable' })
        return
      }
      res.status(200).json({ ok: true, profile: jsonProfile(row) })
      return
    }

    if (req.method === 'PATCH') {
      const body = parseRequestJsonRecord(req)
      if (!body) {
        res.status(400).json({ ok: false, error: 'invalid_body' })
        return
      }
      const patch = parsePatch(body)
      if (!patch) {
        res.status(400).json({ ok: false, error: 'empty_patch' })
        return
      }
      const result = await patchRegisteredOwnerSelf(ownerUid, patch)
      if (result.ok === false) {
        switch (result.error) {
          case 'no_backend':
            res.status(503).json({ ok: false, error: 'owner_backend_unavailable' })
            return
          case 'not_found':
            res.status(404).json({ ok: false, error: 'not_found' })
            return
          case 'invalid_avatar':
            res.status(400).json({ ok: false, error: 'invalid_avatar' })
            return
          default:
            res.status(400).json({ ok: false, error: result.error })
            return
        }
      }
      res.status(200).json({ ok: true, profile: jsonProfile(result.profile) })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch {
    res.status(400).json({ ok: false, error: 'bad_request' })
  }
}
