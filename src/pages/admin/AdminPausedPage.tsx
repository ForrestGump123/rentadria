import { useCallback, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { SEARCH_COUNTRY_IDS, SEARCH_COUNTRY_ISO } from '../../data/cities/countryIds'
import type { SearchCountryId } from '../../data/cities/countryIds'
import { isAdminSession } from '../../utils/adminSession'
import { isOwnerDeleted } from '../../utils/deletedOwnersStore'
import {
  addOneYearIso,
  adminDeleteOwnerUser,
  getAllOwnerProfilesForAdmin,
  type OwnerProfile,
  saveOwnerProfileForAdmin,
} from '../../utils/ownerSession'
import { filterByCountry, isSubscriptionDateExpired, matchesOwnerSearch } from '../../utils/subscriptionAdmin'

function planLabel(p: OwnerProfile, t: (k: string) => string): string {
  if (!p.plan) return '—'
  return t(`owner.planNames.${p.plan}`)
}

function daysSinceExpiry(p: OwnerProfile): number {
  const end = new Date(p.validUntil).getTime()
  if (Number.isNaN(end)) return 0
  return Math.max(0, Math.ceil((Date.now() - end) / 86_400_000))
}

export function AdminPausedPage() {
  const { t } = useTranslation()
  const [epoch, setEpoch] = useState(0)
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState<'all' | SearchCountryId>('all')
  const [contactModal, setContactModal] = useState<OwnerProfile | null>(null)

  const bump = useCallback(() => setEpoch((e) => e + 1), [])

  const rows = useMemo(() => {
    void epoch
    const list = getAllOwnerProfilesForAdmin().filter(
      (p) => !isOwnerDeleted(p.userId) && p.plan != null && isSubscriptionDateExpired(p),
    )
    return filterByCountry(list, country)
      .filter((p) => matchesOwnerSearch(p, search))
      .map((p) => ({ p, days: daysSinceExpiry(p) }))
      .sort((a, b) => b.days - a.days)
  }, [epoch, country, search])

  const onRenew = (p: OwnerProfile) => {
    if (!window.confirm(t('admin.paused.confirmRenew'))) return
    saveOwnerProfileForAdmin(p.userId, {
      ...p,
      validUntil: addOneYearIso(),
      subscriptionActive: true,
    })
    bump()
  }

  const onDelete = (p: OwnerProfile) => {
    if (!window.confirm(t('admin.paused.confirmDelete'))) return
    adminDeleteOwnerUser(p.userId)
    bump()
  }

  const onAutoContact = (p: OwnerProfile) => {
    const subj = encodeURIComponent(t('admin.paused.mailSubject', { name: p.displayName }))
    const body = encodeURIComponent(t('admin.paused.mailBody', { name: p.displayName }))
    window.location.href = `mailto:${encodeURIComponent(p.email)}?subject=${subj}&body=${body}`
  }

  if (!isAdminSession()) return null

  return (
    <div className="ra-admin-expiring">
      <Helmet>
        <title>{t('admin.nav.paused')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <header className="ra-admin-head">
        <h1 className="ra-admin-title">{t('admin.nav.paused')}</h1>
        <p className="ra-admin-subtitle">{t('admin.paused.lead')}</p>
      </header>

      <div className="ra-admin-toolbar ra-admin-expiring__toolbar">
        <label className="ra-fld ra-admin-expiring__search">
          <span>{t('admin.paused.search')}</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('admin.paused.searchPh')} />
        </label>
        <div className="ra-admin-expiring__countries" role="tablist">
          <button
            type="button"
            className={`ra-admin-expiring__tab ${country === 'all' ? 'is-active' : ''}`}
            onClick={() => setCountry('all')}
          >
            {t('admin.expiring.allCountries')}
          </button>
          {SEARCH_COUNTRY_IDS.map((c) => (
            <button
              key={c}
              type="button"
              className={`ra-admin-expiring__tab ${country === c ? 'is-active' : ''}`}
              onClick={() => setCountry(c)}
            >
              {SEARCH_COUNTRY_ISO[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="ra-admin-listings__table-wrap">
        <table className="ra-admin-listings__table">
          <thead>
            <tr>
              <th>{t('admin.paused.colName')}</th>
              <th>{t('admin.paused.colEmail')}</th>
              <th>{t('admin.paused.colPhone')}</th>
              <th>{t('admin.paused.colPlan')}</th>
              <th>{t('admin.paused.colDaysExpired')}</th>
              <th>{t('admin.paused.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="ra-admin-listings__empty">
                  {t('admin.paused.empty')}
                </td>
              </tr>
            ) : (
              rows.map(({ p, days }) => (
                <tr key={p.userId}>
                  <td>{p.displayName}</td>
                  <td className="ra-admin-listings__mono">{p.email}</td>
                  <td>{p.phone ?? '—'}</td>
                  <td>{planLabel(p, t)}</td>
                  <td>{days}</td>
                  <td className="ra-admin-owners__actions-cell">
                    <button type="button" className="ra-btn ra-btn--sm ra-btn--primary" onClick={() => onRenew(p)}>
                      {t('admin.paused.btnRenew')}
                    </button>
                    <button type="button" className="ra-btn ra-btn--sm" onClick={() => setContactModal(p)}>
                      {t('admin.expiring.btnContact')}
                    </button>
                    <button type="button" className="ra-btn ra-btn--sm ra-btn--primary" onClick={() => onAutoContact(p)}>
                      {t('admin.expiring.btnAuto')}
                    </button>
                    <button type="button" className="ra-btn ra-btn--sm ra-admin-listings__btn-del" onClick={() => onDelete(p)}>
                      {t('admin.expiring.btnDelete')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {contactModal && (
        <div className="ra-modal" role="dialog" aria-modal onClick={() => setContactModal(null)}>
          <div className="ra-modal__panel ra-admin-owners__modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="ra-modal__title">{t('admin.expiring.contactTitle')}</h2>
            <p>
              <strong>{contactModal.displayName}</strong>
            </p>
            <p className="ra-admin-listings__mono">{contactModal.email}</p>
            <p>{contactModal.phone ?? '—'}</p>
            <button type="button" className="ra-btn" onClick={() => setContactModal(null)}>
              {t('admin.expiring.contactClose')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
