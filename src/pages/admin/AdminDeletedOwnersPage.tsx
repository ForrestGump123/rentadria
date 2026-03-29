import { useCallback, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { listDeletedOwners } from '../../utils/deletedOwnersStore'
import { formatDateDots, permanentlyEraseDeletedOwnerRecord, restoreDeletedOwner } from '../../utils/ownerSession'
import { isAdminSession } from '../../utils/adminSession'

export function AdminDeletedOwnersPage() {
  const { t } = useTranslation()
  const [epoch, setEpoch] = useState(0)
  const bump = useCallback(() => setEpoch((e) => e + 1), [])

  const rows = useMemo(() => {
    void epoch
    return listDeletedOwners()
  }, [epoch])

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
                  <td>{r.profile.displayName}</td>
                  <td>{r.profile.email}</td>
                  <td>{formatDateDots(r.deletedAt)}</td>
                  <td className="ra-admin-listings__actions ra-admin-owners__actions-row">
                    <button
                      type="button"
                      className="ra-btn ra-btn--sm ra-btn--primary"
                      onClick={() => {
                        restoreDeletedOwner(r.userId)
                        bump()
                      }}
                    >
                      {t('admin.deletedOwners.restore')}
                    </button>
                    <button
                      type="button"
                      className="ra-btn ra-btn--sm ra-admin-listings__btn-del"
                      onClick={() => {
                        if (!window.confirm(t('admin.deletedOwners.confirmPermanent'))) return
                        permanentlyEraseDeletedOwnerRecord(r.userId)
                        bump()
                      }}
                    >
                      {t('admin.deletedOwners.permanent')}
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
