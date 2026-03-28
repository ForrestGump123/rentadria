import type { VercelResponse } from '@vercel/node'

/** U produkciji ne vraćaj interne poruke klijentu (stack, Brevo, …). */
export function sendSafe500(res: VercelResponse, err: unknown, logTag: string): void {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(logTag, msg)
  if (process.env.VERCEL_ENV === 'production') {
    res.status(500).json({ error: 'server_error' })
  } else {
    res.status(500).json({ error: msg.slice(0, 500) })
  }
}

export function send429(res: VercelResponse): void {
  res.status(429).setHeader('Retry-After', '120').json({ error: 'rate_limited' })
}
