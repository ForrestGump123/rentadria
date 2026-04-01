/** SHA-256 hex za pohranu lozinke u demo localStorage profilu. */

export async function sha256Hex(plain: string): Promise<string> {
  const enc = new TextEncoder().encode(plain)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Jednostavno poređenje bez rane grane po bajtu (ograničena zaštita u browseru). */
export function constantTimeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let x = 0
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return x === 0
}
