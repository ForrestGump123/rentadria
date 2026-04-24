import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { getSupabaseAdmin } from '../server/lib/supabaseAdmin.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`owner-avatar-public:${ip}`, 240, 60_000)) {
    send429(res)
    return
  }

  const userId = typeof req.query?.userId === 'string' ? req.query.userId.trim().toLowerCase() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userId)) {
    res.status(400).json({ ok: false, error: 'bad_user' })
    return
  }

  const sb = getSupabaseAdmin()
  if (!sb) {
    res.status(503).json({ ok: false, error: 'owner_backend_unavailable' })
    return
  }

  const { data, error } = await sb
    .from('rentadria_registered_owners')
    .select('avatar_url, avatar_data_url')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    res.status(503).json({ ok: false, error: 'owner_backend_unavailable' })
    return
  }

  const url = typeof (data as any)?.avatar_url === 'string' ? String((data as any).avatar_url).trim() : ''
  const legacy = typeof (data as any)?.avatar_data_url === 'string' ? String((data as any).avatar_data_url).trim() : ''
  const avatarUrl = url || (legacy.startsWith('data:image/') ? legacy : '')
  res.status(200).json({ ok: true, avatarUrl: avatarUrl || null })
}

