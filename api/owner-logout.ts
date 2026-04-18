import type { VercelRequest, VercelResponse } from '@vercel/node'
import { clearOwnerSessionCookieHeader } from '../server/lib/ownerSessionAuth.js'

function secureCookie(): boolean {
  return process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  res.setHeader('Set-Cookie', clearOwnerSessionCookieHeader(secureCookie()))
  res.status(200).json({ ok: true })
}
