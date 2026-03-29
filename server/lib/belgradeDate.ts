/** Kalendarski datum u Europe/Belgrade (Crna Gora / region). */
export function belgradeYmd(d: Date = new Date()): string {
  const s = d.toLocaleDateString('en-CA', {
    timeZone: 'Europe/Belgrade',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return s
}

export function belgradeYm(d: Date = new Date()): string {
  const [y, m] = belgradeYmd(d).split('-')
  return `${y}-${m}`
}

export function belgradeYear(d: Date = new Date()): string {
  return belgradeYmd(d).slice(0, 4)
}

/** Posljednjih n kalendarskih dana (Belgrade), novije prvo. */
export function enumerateLastNDaysBelgrade(n: number): string[] {
  const seen: string[] = []
  const s = new Set<string>()
  for (let i = 0; i < 200 && seen.length < n; i++) {
    const d = new Date(Date.now() - i * 86400000)
    const ymd = belgradeYmd(d)
    if (!s.has(ymd)) {
      s.add(ymd)
      seen.push(ymd)
    }
  }
  return seen
}

/** Posljednjih n kalendarskih mjeseci (od tekućeg), format yyyy-mm. */
export function enumerateLastNMonthsBelgrade(n: number): string[] {
  const [ys, ms] = belgradeYmd().split('-')
  let y = Number(ys)
  let m = Number(ms)
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m -= 1
    if (m < 1) {
      m = 12
      y -= 1
    }
  }
  return out
}
