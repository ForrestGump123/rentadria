/** Build tel: href for click-to-call (mobile dialer / desktop handlers). */
export function telHrefFromPhone(phone: string): string | null {
  const t = phone.trim()
  if (!t) return null
  const cleaned = t.replace(/[^\d+]/g, '')
  if (!/\d/.test(cleaned)) return null
  return `tel:${cleaned}`
}
