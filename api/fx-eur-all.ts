import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const r = await fetch('https://api.frankfurter.app/latest?from=EUR&to=ALL')
    if (!r.ok) {
      res.status(502).json({ error: 'fx_upstream_failed' })
      return
    }
    const j = (await r.json()) as { rates?: { ALL?: number } }
    const rate = j?.rates?.ALL
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
      res.status(502).json({ error: 'fx_bad_response' })
      return
    }

    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=900, stale-while-revalidate=86400')
    res.status(200).json({ ok: true, eurToAll: rate })
  } catch {
    res.status(502).json({ error: 'fx_fetch_failed' })
  }
}

