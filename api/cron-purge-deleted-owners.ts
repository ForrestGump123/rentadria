import type { VercelRequest, VercelResponse } from '@vercel/node'
import { purgeDeletedOwnersOlderThan } from '../server/lib/deletedOwnersDb.js'

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!authorizeCron(req)) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  const days = typeof req.query?.days === 'string' ? parseInt(req.query.days, 10) || 30 : 30
  const result = await purgeDeletedOwnersOlderThan(days)
  res.status(200).json({ ok: true, ...result })
}

