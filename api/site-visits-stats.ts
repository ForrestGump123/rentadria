import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sendSafe500, send429 } from '../server/lib/apiSafe.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'
import {
  enumerateLastNDaysBelgrade,
  enumerateLastNMonthsBelgrade,
} from '../server/lib/belgradeDate.js'
import {
  dayBreakdown,
  dayTotal,
  loadVisits,
  monthBreakdown,
  monthTotal,
  yearBreakdown,
  yearTotal,
  yearsInData,
} from '../server/lib/siteVisitsStore.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`visstats:${ip}`, 80, 60_000)) {
    send429(res)
    return
  }

  const statsSecret = process.env.SITE_VISITS_READ_SECRET?.trim()
  if (statsSecret) {
    const auth = String(req.headers.authorization ?? '')
    if (auth !== `Bearer ${statsSecret}`) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }
  }

  try {
    const data = await loadVisits()
    const dayKeys = enumerateLastNDaysBelgrade(90)
    const daily = dayKeys.map((day) => ({
      day,
      visits: dayTotal(day, data),
    }))

    const monthKeys = enumerateLastNMonthsBelgrade(24)
    const monthly = monthKeys.map((ym) => ({
      month: ym,
      visits: monthTotal(ym, data),
    }))

    const yearKeys = yearsInData(data)
    const yearly = yearKeys.map((year) => ({
      year,
      visits: yearTotal(year, data),
    }))

    const q = typeof req.query?.detail === 'string' ? req.query.detail : ''
    const key = typeof req.query?.key === 'string' ? req.query.key : ''

    const dayOk = /^\d{4}-\d{2}-\d{2}$/.test(key)
    const monthOk = /^\d{4}-\d{2}$/.test(key)
    const yearOk = /^\d{4}$/.test(key)

    let detail: { byCountry: Record<string, number>; byCity: Record<string, number> } | null =
      null
    if (q === 'day' && dayOk && dayKeys.includes(key)) {
      detail = dayBreakdown(key, data)
    } else if (q === 'month' && monthOk && monthKeys.includes(key)) {
      detail = monthBreakdown(key, data)
    } else if (q === 'year' && yearOk && yearKeys.includes(key)) {
      detail = yearBreakdown(key, data)
    }

    res.status(200).json({
      daily,
      monthly,
      yearly,
      detail,
      detailScope: q && key ? { type: q, key } : null,
    })
  } catch (e) {
    sendSafe500(res, e, 'site-visits-stats')
  }
}
