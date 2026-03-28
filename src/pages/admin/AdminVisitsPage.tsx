import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'

type Tab = 'daily' | 'monthly' | 'yearly'

type StatsPayload = {
  daily: { day: string; visits: number }[]
  monthly: { month: string; visits: number }[]
  yearly: { year: string; visits: number }[]
}

type DetailPayload = {
  byCountry: Record<string, number>
  byCity: Record<string, number>
} | null

function sortEntries(desc: Record<string, number>): [string, number][] {
  return Object.entries(desc).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

export function AdminVisitsPage() {
  const { t, i18n } = useTranslation()
  const [stats, setStats] = useState<StatsPayload | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('daily')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailPayload>(null)

  const statsHeaders = useMemo(() => {
    const sk = import.meta.env.VITE_SITE_VISITS_READ_SECRET?.trim()
    if (!sk) return undefined
    return { Authorization: `Bearer ${sk}` } as HeadersInit
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/site-visits-stats', statsHeaders ? { headers: statsHeaders } : undefined)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad'))))
      .then((data: StatsPayload) => {
        if (!cancelled) {
          setStats(data)
          setErr(null)
        }
      })
      .catch(() => {
        if (!cancelled) setErr(t('admin.visits.loadError'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [t, statsHeaders])

  useEffect(() => {
    if (!selectedKey) {
      setDetail(null)
      return
    }
    const q = tab === 'daily' ? 'day' : tab === 'monthly' ? 'month' : 'year'
    let cancelled = false
    fetch(
      `/api/site-visits-stats?detail=${encodeURIComponent(q)}&key=${encodeURIComponent(selectedKey)}`,
      statsHeaders ? { headers: statsHeaders } : undefined,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad'))))
      .then((d: { detail: DetailPayload }) => {
        if (!cancelled) setDetail(d.detail)
      })
      .catch(() => {
        if (!cancelled) setDetail(null)
      })
    return () => {
      cancelled = true
    }
  }, [selectedKey, tab, statsHeaders])

  const regionNames = useMemo(
    () => new Intl.DisplayNames([i18n.language], { type: 'region' }),
    [i18n.language],
  )

  const formatDay = (day: string) => {
    const d = new Date(`${day}T12:00:00`)
    return d.toLocaleDateString(i18n.language, {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Belgrade',
    })
  }

  const formatMonth = (ym: string) => {
    const [y, m] = ym.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString(i18n.language, {
      month: 'long',
      year: 'numeric',
    })
  }

  const countryLabel = (code: string) => {
    if (code === 'XX') return t('admin.visits.unknownCountry')
    try {
      return regionNames.of(code) ?? code
    } catch {
      return code
    }
  }

  const parseCityKey = (key: string): { code: string; city: string } => {
    const i = key.indexOf('|')
    if (i < 0) return { code: key, city: '' }
    return { code: key.slice(0, i), city: key.slice(i + 1) }
  }

  const onPickTab = (next: Tab) => {
    setTab(next)
    setSelectedKey(null)
    setDetail(null)
  }

  const onPickRow = (key: string) => {
    setSelectedKey((prev) => (prev === key ? null : key))
  }

  const tableRows =
    tab === 'daily' ? stats?.daily : tab === 'monthly' ? stats?.monthly : stats?.yearly

  const periodLabel =
    selectedKey == null
      ? ''
      : tab === 'daily'
        ? formatDay(selectedKey)
        : tab === 'monthly'
          ? formatMonth(selectedKey)
          : selectedKey

  return (
    <div className="ra-admin-visits">
      <Helmet>
        <title>{t('admin.visits.pageTitle')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <header className="ra-admin-head">
        <h1 className="ra-admin-title">{t('admin.visits.heading')}</h1>
        <p className="ra-admin-subtitle">{t('admin.visits.subtitle')}</p>
      </header>

      {loading && <p className="ra-admin-visits__hint">{t('admin.visits.loading')}</p>}
      {err && <p className="ra-admin-visits__err">{err}</p>}

      {!loading && !err && (
        <>
          <div className="ra-admin-visits__tabs" role="tablist" aria-label={t('admin.visits.tablist')}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'daily'}
              className={`ra-admin-visits__tab ${tab === 'daily' ? 'is-active' : ''}`}
              onClick={() => onPickTab('daily')}
            >
              <span className="ra-admin-visits__tab-ico" aria-hidden>
                🇲🇪
              </span>
              {t('admin.visits.tabDaily')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'monthly'}
              className={`ra-admin-visits__tab ${tab === 'monthly' ? 'is-active' : ''}`}
              onClick={() => onPickTab('monthly')}
            >
              {t('admin.visits.tabMonthly')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'yearly'}
              className={`ra-admin-visits__tab ${tab === 'yearly' ? 'is-active' : ''}`}
              onClick={() => onPickTab('yearly')}
            >
              {t('admin.visits.tabYearly')}
            </button>
          </div>

          <section className="ra-admin-visits__block" aria-labelledby="visits-table-h">
            <h2 id="visits-table-h" className="ra-admin-visits__block-title">
              {tab === 'daily' && t('admin.visits.blockDaily')}
              {tab === 'monthly' && t('admin.visits.blockMonthly')}
              {tab === 'yearly' && t('admin.visits.blockYearly')}
            </h2>
            <div className="ra-admin-visits__table-wrap">
              <table className="ra-admin-visits__table">
                <thead>
                  <tr>
                    <th scope="col">
                      {tab === 'daily'
                        ? t('admin.visits.colDate')
                        : tab === 'monthly'
                          ? t('admin.visits.colMonth')
                          : t('admin.visits.colYear')}
                    </th>
                    <th scope="col" className="ra-admin-visits__num">
                      {t('admin.visits.colVisits')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(tableRows ?? []).map((row) => {
                    const k =
                      tab === 'daily'
                        ? (row as { day: string }).day
                        : tab === 'monthly'
                          ? (row as { month: string }).month
                          : (row as { year: string }).year
                    const v =
                      tab === 'daily'
                        ? (row as { day: string; visits: number }).visits
                        : tab === 'monthly'
                          ? (row as { month: string; visits: number }).visits
                          : (row as { year: string; visits: number }).visits
                    const label =
                      tab === 'daily' ? formatDay(k) : tab === 'monthly' ? formatMonth(k) : k
                    const active = selectedKey === k
                    return (
                      <tr key={k}>
                        <td>
                          <button
                            type="button"
                            className={`ra-admin-visits__rowbtn ${active ? 'is-active' : ''}`}
                            onClick={() => onPickRow(k)}
                          >
                            {label}
                          </button>
                        </td>
                        <td className="ra-admin-visits__num">{v}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {selectedKey && (
            <section className="ra-admin-visits__detail" aria-labelledby="visits-detail-h">
              <h2 id="visits-detail-h" className="ra-admin-visits__detail-title">
                {t('admin.visits.detailTitle', { period: periodLabel })}
              </h2>
              {!detail ? (
                <p className="ra-admin-visits__hint">{t('admin.visits.detailLoading')}</p>
              ) : sortEntries(detail.byCountry).length === 0 && sortEntries(detail.byCity).length === 0 ? (
                <p className="ra-admin-visits__hint">{t('admin.visits.emptyDetails')}</p>
              ) : (
                <div className="ra-admin-visits__detail-grid">
                  <div>
                    <h3 className="ra-admin-visits__subh">{t('admin.visits.byCountry')}</h3>
                    <table className="ra-admin-visits__table ra-admin-visits__table--compact">
                      <thead>
                        <tr>
                          <th scope="col">{t('admin.visits.colCountry')}</th>
                          <th scope="col" className="ra-admin-visits__num">
                            {t('admin.visits.colVisits')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortEntries(detail.byCountry).map(([code, n]) => (
                          <tr key={code}>
                            <td>{countryLabel(code)}</td>
                            <td className="ra-admin-visits__num">{n}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <h3 className="ra-admin-visits__subh">{t('admin.visits.byCity')}</h3>
                    <table className="ra-admin-visits__table ra-admin-visits__table--compact">
                      <thead>
                        <tr>
                          <th scope="col">{t('admin.visits.colCity')}</th>
                          <th scope="col" className="ra-admin-visits__num">
                            {t('admin.visits.colVisits')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortEntries(detail.byCity).map(([key, n]) => {
                          const { code, city } = parseCityKey(key)
                          const place =
                            city && city !== '—'
                              ? `${countryLabel(code)} — ${city}`
                              : countryLabel(code)
                          return (
                            <tr key={key}>
                              <td>{place}</td>
                              <td className="ra-admin-visits__num">{n}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
