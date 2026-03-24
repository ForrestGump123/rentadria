/** Registration: ≥8 chars, at least one uppercase letter, and a digit or a special character */
export function isValidRegisterPassword(s: string): boolean {
  if (s.length < 8) return false
  if (!/[A-Z]/.test(s)) return false
  if (!/[\d]/.test(s) && !/[^A-Za-z0-9]/.test(s)) return false
  return true
}
