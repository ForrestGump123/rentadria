import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuthDispatch, adminAuthIpFromVercel } from '../server/lib/adminAuthDispatch.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const body = req.method === 'POST' ? parseRequestJsonRecord(req) : {}
  const ip = adminAuthIpFromVercel(req)
  const secureCookie =
    process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
  const cookieHeader =
    typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined

  const result = await adminAuthDispatch({
    method: String(req.method ?? 'GET'),
    cookieHeader,
    body,
    ip,
    secureCookie,
  })

  if (result.setCookie) {
    res.setHeader('Set-Cookie', result.setCookie)
  }
  res.status(result.status).json(result.json)
}
