/** Kratak prikaz ID-a u admin tabelama (ne mijenja stvarni userId). */
export function shortOwnerId(userId: string): string {
  const s = userId.trim()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
    const [loc, dom] = s.split('@')
    const d = (dom ?? '').split('.')[0] ?? ''
    return `${(loc ?? '').slice(0, 10)}…@${d}`
  }
  if (s.length <= 10) return s
  return `${s.slice(0, 8)}…`
}
