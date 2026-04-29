import { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getListingById } from '../../data/listings'
import { isAdminSession } from '../../utils/adminSession'
import { formatDateDots } from '../../utils/ownerSession'
import { clearAdminReportsUnread } from '../../utils/storage'

type ReportRow = Record<string, string> & { at?: string }

export function AdminReportsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [epoch, setEpoch] = useState(0)
  const [rows, setRows] = useState<ReportRow[]>([])

  const bump = useCallback(() => setEpoch((e) => e + 1), [])

  useEffect(() => {
    clearAdminReportsUnread()
    bump()
  }, [bump])

  useEffect(() => {
    const on = () => bump()
    window.addEventListener('rentadria-reports-updated', on)
    return () => window.removeEventListener('rentadria-reports-updated', on)
  }, [bump])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch('/api/admin-reports-list', { credentials: 'include' })
        const j = (await r.json()) as {
          ok?: boolean
          rows?: { id: string; payload: Record<string, string>; at: string }[]
        }
        if (cancelled || !r.ok || !j.ok || !Array.isArray(j.rows)) {
          if (!cancelled) setRows([])
          return
        }
        setRows(
          j.rows.map((x) => ({
            ...x.payload,
            at: x.at,
          })),
        )
      } catch {
        if (!cancelled) setRows([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [epoch])

  const sorted = useMemo(
    () => rows.slice().sort((a, b) => (b.at ?? '').localeCompare(a.at ?? '')),
    [rows],
  )

  if (!isAdminSession()) return null

  return (
    <div className="ra-admin-inquiries">
      <Helmet>
        <title>{t('admin.reports.pageTitle')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <header className="ra-admin-head">
        <h1 className="ra-admin-title">{t('admin.reports.heading')}</h1>
        <p className="ra-admin-subtitle">{t('admin.reports.lead')}</p>
      </header>

      <div className="ra-admin-listings__table-wrap">
        <table className="ra-admin-listings__table">
          <thead>
            <tr>
              <th>{t('admin.reports.colDate')}</th>
              <th>{t('admin.reports.colListing')}</th>
              <th>{t('admin.reports.colReason')}</th>
              <th>{t('admin.reports.colReporter')}</th>
              <th>{t('admin.reports.colEmail')}</th>
              <th>{t('admin.reports.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="ra-admin-listings__empty">
                  {t('admin.reports.empty')}
                </td>
              </tr>
            ) : (
              sorted.map((r, i) => {
                const lid = r.listingId ?? ''
                const listing = lid ? getListingById(lid) : undefined
                return (
                  <tr key={`${r.at}-${i}`}>
                    <td>{r.at ? formatDateDots(r.at) : '—'}</td>
                    <td className="ra-admin-listings__mono">{listing?.location ?? lid}</td>
                    <td className="ra-admin-inquiries__preview">{(r.reason ?? '').slice(0, 120)}</td>
                    <td>
                      {r.first} {r.last}
                    </td>
                    <td>{r.email}</td>
                    <td className="ra-admin-listings__actions">
                      <button
                        type="button"
                        className="ra-btn ra-btn--sm ra-admin-listings__btn-view"
                        onClick={() => {
                          if (listing) navigate(`/listing/${lid}`)
                          else window.alert(t('admin.owners.noPublicListing'))
                        }}
                      >
                        {t('admin.inquiries.viewListing')}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
