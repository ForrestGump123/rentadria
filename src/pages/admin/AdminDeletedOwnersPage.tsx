import { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { formatDateDots } from '../../utils/ownerSession'
import { isAdminSession } from '../../utils/adminSession'

type Row = {
  userId: string
  email: string
  displayName: string
  deletedAt: string
}

export function AdminDeletedOwnersPage() {
  const { t } = useTranslation()
  const [epoch, setEpoch] = useState(0)
  const [rowsServer, setRowsServer] = useState<Row[]>([])
  const bump = useCallback(() => setEpoch((e) => e + 1), [])

  const rows = useMemo(() => {
    void epoch
    return rowsServer
  }, [epoch, rowsServer])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch('/api/admin-deleted-owners', { credentials: 'include' })
        const j = (await r.json()) as { ok?: boolean; owners?: Row[] }
        if (!cancelled && r.ok && j.ok && Array.isArray(j.owners)) {
          setRowsServer(j.owners)
          bump()
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bump])

  if (!isAdminSession()) {
    return null
  }

  return (
    <div className="ra-admin-deleted">
      <Helmet>
        <title>{t('admin.deletedOwners.pageTitle')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <header className="ra-admin-head">
        <h1 className="ra-admin-title">{t('admin.deletedOwners.heading')}</h1>
        <p className="ra-admin-subtitle">{t('admin.deletedOwners.lead')}</p>
        <p className="ra-admin-subtitle">{t('admin.deletedOwners.retention30')}</p>
      </header>

      <div className="ra-admin-listings__table-wrap">
        <table className="ra-admin-listings__table">
          <thead>
            <tr>
              <th>{t('admin.deletedOwners.colName')}</th>
              <th>{t('admin.deletedOwners.colEmail')}</th>
              <th>{t('admin.deletedOwners.colDeleted')}</th>
              <th>{t('admin.deletedOwners.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="ra-admin-listings__empty">
                  {t('admin.deletedOwners.empty')}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.userId}>
                  <td>{r.displayName}</td>
                  <td>{r.email}</td>
                  <td>{formatDateDots(r.deletedAt)}</td>
                  <td className="ra-admin-listings__actions ra-admin-owners__actions-row">
                    <button
                      type="button"
                      className="ra-btn ra-btn--sm ra-btn--primary"
                      onClick={() => {
                        void (async () => {
                          await fetch('/api/admin-deleted-owners', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ action: 'restore', userId: r.userId }),
                          }).catch(() => {})
                          const rr = await fetch('/api/admin-deleted-owners', { credentials: 'include' })
                          const jj = (await rr.json().catch(() => ({}))) as { ok?: boolean; owners?: Row[] }
                          if (rr.ok && jj.ok && Array.isArray(jj.owners)) setRowsServer(jj.owners)
                          bump()
                        })()
                      }}
                    >
                      {t('admin.deletedOwners.restore')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
