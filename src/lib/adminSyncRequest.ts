import type { ListingCategory } from '../types'
import { loadPartners, runSyncJob } from '../utils/syncPartnersStore'

export async function adminSyncRequest(opts: {
  scope: 'owner' | 'site'
  userId?: string
  partnerId: string
  categories: ListingCategory[]
  /** Lokalni stub log: oznaka testa. */
  mode?: 'test' | 'run'
}): Promise<{ ok: boolean; error?: string }> {
  const partner = loadPartners().find((p) => p.id === opts.partnerId)
  if (!partner) return { ok: false, error: 'no_partner' }

  const secret = import.meta.env.VITE_ADMIN_SYNC_SECRET?.trim()
  if (secret) {
    try {
      const r = await fetch('/api/admin-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({
          scope: opts.scope,
          userId: opts.userId,
          partnerId: opts.partnerId,
          categories: opts.categories,
        }),
      })
      if (!r.ok) {
        const t = await r.text()
        return { ok: false, error: t || String(r.status) }
      }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'network' }
    }
  }

  runSyncJob({
    scope: opts.scope,
    userId: opts.userId,
    partner,
    categories: opts.categories,
    label: opts.mode === 'test' ? '[TEST]' : undefined,
  })
  return { ok: true }
}
