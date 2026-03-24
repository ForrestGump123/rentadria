import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyVerifyToken } from './lib/verifyJwt'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const raw = req.body
    const body =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : typeof raw === 'string'
          ? (JSON.parse(raw) as Record<string, unknown>)
          : {}
    const token = String(body?.token ?? '').trim()
    if (!token) {
      res.status(400).json({ error: 'missing_token' })
      return
    }

    const payload = await verifyVerifyToken(token)
    let plan = payload.plan
    if (!['basic', 'pro', 'agency'].includes(plan)) plan = 'basic'

    res.status(200).json({
      ok: true,
      email: payload.email,
      name: payload.name,
      plan,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'invalid_token'
    res.status(400).json({ error: msg })
  }
}
