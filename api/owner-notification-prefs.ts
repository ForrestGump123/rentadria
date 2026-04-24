import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { ownerUserIdFromCookie } from '../server/lib/ownerSessionAuth.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { getSupabaseAdmin } from '../server/lib/supabaseAdmin.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'

type Prefs = { receiveEnabled: boolean; emailChannel: boolean; dashboardChannel: boolean }

function normalizePrefs(x: unknown): Prefs {
  const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : {}
  const receiveEnabled = o.receiveEnabled !== false
  return {
    receiveEnabled,
    emailChannel: receiveEnabled && o.emailChannel !== false,
    dashboardChannel: receiveEnabled && o.dashboardChannel !== false,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`owner-notification-prefs:${ip}`, 120, 60_000)) {
    send429(res)
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const ownerUid = await ownerUserIdFromCookie(cookieHeader)
  if (!ownerUid) {
    res.status(401).json({ ok: false, error: 'owner_auth_required' })
    return
  }

  const sb = getSupabaseAdmin()
  if (!sb) {
    res.status(503).json({ ok: false, error: 'owner_backend_unavailable' })
    return
  }

  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('rentadria_owner_notification_prefs')
      .select('receive_enabled, email_channel, dashboard_channel')
      .eq('user_id', ownerUid)
      .maybeSingle()
    if (error) {
      res.status(503).json({ ok: false, error: 'owner_backend_unavailable' })
      return
    }
    const prefs = normalizePrefs({
      receiveEnabled: data?.receive_enabled ?? true,
      emailChannel: data?.email_channel ?? true,
      dashboardChannel: data?.dashboard_channel ?? true,
    })
    res.status(200).json({ ok: true, prefs })
    return
  }

  if (req.method === 'POST') {
    const body = parseRequestJsonRecord(req)
    const prefs = normalizePrefs(body?.prefs)
    const { error } = await sb.from('rentadria_owner_notification_prefs').upsert(
      {
        user_id: ownerUid,
        receive_enabled: prefs.receiveEnabled,
        email_channel: prefs.emailChannel,
        dashboard_channel: prefs.dashboardChannel,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    if (error) {
      res.status(503).json({ ok: false, error: 'owner_backend_unavailable' })
      return
    }
    res.status(200).json({ ok: true })
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}

