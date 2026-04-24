import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from '../server/lib/supabaseAdmin.js'
import { sendTransactionalEmail } from '../server/lib/sendBrevoMail.js'
import { createOwnerNotification } from '../server/lib/ownerNotificationsDb.js'

function authorizeCron(req: VercelRequest): boolean {
  if (process.env.VERCEL === '1' && String(req.headers['x-vercel-cron'] ?? '') === '1') {
    return true
  }
  const expected = process.env.CRON_SECRET?.trim()
  if (!expected) return process.env.NODE_ENV !== 'production'
  const auth = String(req.headers.authorization ?? '')
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const q = req.query?.secret
  const qsecret = typeof q === 'string' ? q : Array.isArray(q) ? q[0] : ''
  return bearer === expected || qsecret === expected
}

type OwnerRow = {
  user_id: string
  email: string
  display_name: string
  valid_until: string | null
  subscription_active: boolean
  plan: string | null
}

function daysLeft(endIso: string, now = Date.now()): number | null {
  const end = new Date(endIso).getTime()
  if (Number.isNaN(end)) return null
  const diff = end - now
  return Math.ceil(diff / 86_400_000)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!authorizeCron(req)) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  const sb = getSupabaseAdmin()
  if (!sb) {
    res.status(503).json({ error: 'supabase_not_configured' })
    return
  }

  const targets = new Set([30, 15, 2])
  const nowMs = Date.now()

  // Keep it bounded for Vercel runtime.
  const { data, error } = await sb
    .from('rentadria_registered_owners')
    .select('user_id, email, display_name, valid_until, subscription_active, plan')
    .not('valid_until', 'is', null)
    .eq('subscription_active', true)
    .limit(5000)

  if (error || !Array.isArray(data)) {
    res.status(500).json({ error: error?.message ?? 'select_failed' })
    return
  }

  let scanned = 0
  let due = 0
  let notified = 0
  const failures: Array<{ userId: string; error: string }> = []

  for (const raw of data as unknown as OwnerRow[]) {
    scanned++
    const userId = String(raw.user_id || '').trim().toLowerCase()
    const email = String(raw.email || userId).trim().toLowerCase()
    const name = String(raw.display_name || '').trim() || userId.split('@')[0] || userId
    const vu = raw.valid_until ? String(raw.valid_until) : ''
    if (!userId || !email || !vu) continue
    if (!raw.plan) continue

    const left = daysLeft(vu, nowMs)
    if (left == null) continue
    if (!targets.has(left)) continue
    due++

    const title =
      left === 30
        ? 'Pretplata ističe za 30 dana'
        : left === 15
          ? 'Pretplata ističe za 15 dana'
          : 'Pretplata ističe za 2 dana'

    const planLabel = String(raw.plan).toUpperCase()
    const body = `Vaš paket ističe za ${left} dana.\n\nPlan: ${planLabel}\nVaži do: ${vu}\n\nAko želite produženje ili imate pitanje, pišite adminu kroz „Interne poruke“ u vlasničkom panelu.`

    try {
      // Internal notification (deduped by unique index).
      const okNotif = await createOwnerNotification({
        userId,
        kind: 'expiry_reminder',
        title,
        body,
        refValidUntilIso: vu,
        daysBefore: left,
      })
      if (okNotif) {
        // Email is best-effort; still try every run, but notification insert prevents duplicates.
        await sendTransactionalEmail({
          to: email,
          toName: name,
          subject: `RentAdria — ${title}`,
          html: `<p>Zdravo ${escapeHtml(name)},</p>
<p>Ovo je podsjetnik sa <strong>RentAdria</strong>:</p>
<p><strong>${escapeHtml(title)}</strong></p>
<ul>
  <li><strong>Paket:</strong> ${escapeHtml(planLabel)}</li>
  <li><strong>Važi do:</strong> ${escapeHtml(vu)}</li>
</ul>
<p>Ako želite produženje ili imate pitanje, pišite adminu kroz „Interne poruke“ u vlasničkom panelu.</p>`,
        })
        notified++
      }
    } catch (e) {
      failures.push({ userId, error: e instanceof Error ? e.message : String(e) })
    }
  }

  res.status(200).json({
    ok: true,
    scanned,
    due,
    notified,
    failures: failures.slice(0, 50),
  })
}

