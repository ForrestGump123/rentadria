import type { ListingCategory } from '../types'

export async function adminSyncRequest(opts: {
  scope: 'owner' | 'site'
  userId?: string
  partnerId: string
  categories: ListingCategory[]
  /** Lokalni stub log: oznaka testa. */
  mode?: 'test' | 'run'
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch('/api/admin-sync-now', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: opts.scope,
        userId: opts.userId,
        partnerId: opts.partnerId,
        categories: opts.categories,
        mode: opts.mode ?? 'run',
      }),
    })
    if (!r.ok) {
      const t = await r.text()
      return { ok: false, error: t || String(r.status) }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network' }
  }
}
