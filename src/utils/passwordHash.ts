/** SHA-256 hex za pohranu lozinke u demo localStorage profilu. */

export async function sha256Hex(plain: string): Promise<string> {
  const enc = new TextEncoder().encode(plain)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
