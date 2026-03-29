import type { VercelRequest } from '@vercel/node'

/** Vercel Node: `body` is usually parsed JSON, but can be a string or Buffer on some configs. */
export function parseRequestJsonRecord(req: VercelRequest): Record<string, unknown> {
  const raw = req.body as unknown
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown
      return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }
  if (raw instanceof Buffer) {
    try {
      const o = JSON.parse(raw.toString('utf8')) as unknown
      return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }
  return {}
}
