import type { VercelRequest } from '@vercel/node'

function pickHeader(
  h: VercelRequest['headers'],
  ...names: string[]
): string {
  for (const name of names) {
    const v = h[name] ?? h[name.toLowerCase()]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (Array.isArray(v) && v[0]) return v[0].trim()
  }
  return ''
}

/**
 * Geo iz Vercel / Cloudflare / sličnih headera.
 * Grad može biti prazan.
 */
export function geoFromRequest(req: VercelRequest): { countryCode: string; city: string } {
  const h = req.headers
  const country =
    pickHeader(h, 'x-vercel-ip-country', 'cf-ipcountry', 'x-country-code') || ''

  const city = pickHeader(h, 'x-vercel-ip-city', 'cf-ipcity') || ''

  return {
    countryCode: (country || 'XX').toUpperCase().slice(0, 2),
    city: city ? city.slice(0, 120) : '',
  }
}
