/**
 * Jednostavan rate limit po ključu (IP, email, …) — po instanci serverlessa.
 * Za produkciju: dodatno Vercel WAF / Edge; ovo sprječava lake abuse skripte.
 */

const buckets = new Map<string, number[]>()

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const prev = buckets.get(key) ?? []
  const fresh = prev.filter((t) => now - t < windowMs)
  if (fresh.length >= max) {
    buckets.set(key, fresh)
    return false
  }
  fresh.push(now)
  buckets.set(key, fresh)
  return true
}

export function rateLimitIp(ip: string, max: number, windowMs: number): boolean {
  return rateLimit(`ip:${ip}`, max, windowMs)
}

export function clientIp(req: { headers: Record<string, string | string[] | undefined> }): string {
  const h = req.headers
  const xff = h['x-forwarded-for']
  const first =
    typeof xff === 'string'
      ? xff.split(',')[0]?.trim()
      : Array.isArray(xff)
        ? xff[0]?.trim()
        : ''
  if (first) return first.slice(0, 64)
  const rip = h['x-real-ip']
  if (typeof rip === 'string' && rip) return rip.slice(0, 64)
  return 'unknown'
}
