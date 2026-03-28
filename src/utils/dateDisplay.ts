/**
 * Formats a date string for UI: day.month.year (DD.MM.YYYY).
 * Accepts HTML date value `YYYY-MM-DD` or ISO strings without shifting calendar day (UTC noon for ISO).
 */
export function formatDateDayMonthYear(value: string): string {
  const v = value.trim()
  if (!v) return '—'
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (ymd) {
    const [, y, m, d] = ymd
    return `${d}.${m}.${y}`
  }
  const dt = new Date(v)
  if (Number.isNaN(dt.getTime())) return v
  return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`
}
