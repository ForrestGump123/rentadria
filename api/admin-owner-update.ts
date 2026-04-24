import type { VercelRequest, VercelResponse } from '@vercel/node'
import { send429 } from '../server/lib/apiSafe.js'
import { verifyAdminCookie } from '../server/lib/adminAuthDispatch.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { getRegisteredOwnerProfile, updateRegisteredOwnerByAdmin } from '../server/lib/registeredOwnersDb.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import { createOwnerNotification } from '../server/lib/ownerNotificationsDb.js'
import { sendTransactionalEmail } from '../server/lib/sendBrevoMail.js'

const PLANS = new Set(['basic', 'pro', 'agency'])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`admin-owner-update:${ip}`, 25, 60_000)) {
    send429(res)
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const adminOk = await verifyAdminCookie(cookieHeader)
  if (!adminOk) {
    res.status(401).json({ ok: false })
    return
  }

  try {
    const body = parseRequestJsonRecord(req)
    const userId = String(body?.userId ?? '').trim().toLowerCase()
    const displayName = String(body?.displayName ?? '').trim()
    const email = String(body?.email ?? '').trim().toLowerCase()
    const phoneRaw = body?.phone
    const phone = typeof phoneRaw === 'string' ? phoneRaw.trim().slice(0, 80) : null
    const countryIdRaw = body?.countryId
    const countryId =
      typeof countryIdRaw === 'string' && countryIdRaw.trim() ? countryIdRaw.trim().toLowerCase() : null
    const passwordHashRaw = body?.passwordHash
    const passwordHash =
      typeof passwordHashRaw === 'string' && /^[a-f0-9]{64}$/i.test(passwordHashRaw.trim())
        ? passwordHashRaw.trim().toLowerCase()
        : null

    const planRaw = body?.plan
    let plan: 'basic' | 'pro' | 'agency' | null = null
    if (planRaw === null || planRaw === undefined || planRaw === '') plan = null
    else if (typeof planRaw === 'string' && PLANS.has(planRaw)) plan = planRaw as 'basic' | 'pro' | 'agency'

    const subscriptionActive = Boolean(body?.subscriptionActive)

    const vuRaw = body?.validUntil
    let validUntil: string | null = null
    if (typeof vuRaw === 'string' && vuRaw.trim()) validUntil = vuRaw.trim()

    const bcRaw = body?.basicCategoryChoice
    let basicCategoryChoice: 'accommodation' | 'car' | 'motorcycle' | null = null
    if (bcRaw === null || bcRaw === undefined || bcRaw === '') basicCategoryChoice = null
    else if (bcRaw === 'accommodation' || bcRaw === 'car' || bcRaw === 'motorcycle') basicCategoryChoice = bcRaw

    const adminMetaRaw = body?.adminMeta
    const adminMeta =
      adminMetaRaw && typeof adminMetaRaw === 'object' && !Array.isArray(adminMetaRaw)
        ? (adminMetaRaw as Record<string, unknown>)
        : {}

    if (!userId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userId)) {
      res.status(400).json({ ok: false, error: 'invalid_user' })
      return
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ ok: false, error: 'invalid_email' })
      return
    }

    const result = await updateRegisteredOwnerByAdmin({
      userId,
      displayName: displayName || userId.split('@')[0] || userId,
      email,
      phone,
      countryId,
      passwordHash,
      plan,
      subscriptionActive,
      validUntil,
      basicCategoryChoice,
      adminMeta,
    })

    if (!result.ok) {
      res.status(result.error === 'no_backend' ? 503 : 400).json({ ok: false, error: result.error ?? 'update_failed' })
      return
    }

    // Notify owner about plan/package changes (best-effort; don't fail the admin save).
    try {
      const after = await getRegisteredOwnerProfile(userId)
      if (after) {
        const title = 'Promjena paketa / pretplate'
        const planLabel = after.plan ? after.plan.toUpperCase() : 'NEMA'
        const statusLabel = after.subscriptionActive ? 'AKTIVNO' : 'NEAKTIVNO'
        const bodyText = `Admin je ažurirao vaš paket.\n\nPlan: ${planLabel}\nStatus: ${statusLabel}\nVaži do: ${after.validUntil || '—'}\n\nAko imate pitanja, pišite adminu kroz „Interne poruke“.`
        void createOwnerNotification({
          userId: after.userId,
          kind: 'plan_change',
          title,
          body: bodyText,
          refValidUntilIso: after.validUntil || null,
        })
        void sendTransactionalEmail({
          to: after.email,
          toName: after.displayName || after.email,
          subject: 'RentAdria — promjena paketa',
          html: `<p>Zdravo${after.displayName ? ` ${escapeHtml(after.displayName)}` : ''},</p>
<p>Admin je ažurirao vaš paket na <strong>RentAdria</strong>.</p>
<ul>
  <li><strong>Plan:</strong> ${escapeHtml(planLabel)}</li>
  <li><strong>Status:</strong> ${escapeHtml(statusLabel)}</li>
  <li><strong>Važi do:</strong> ${escapeHtml(after.validUntil || '—')}</li>
</ul>
<p>Za dodatna pitanja možete pisati adminu kroz „Interne poruke“ u vlasničkom panelu.</p>`,
        })
      }
    } catch {
      /* ignore */
    }
    res.status(200).json({ ok: true })
  } catch {
    res.status(400).json({ ok: false, error: 'bad_request' })
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
