import { useCallback, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { SEARCH_COUNTRY_IDS, SEARCH_COUNTRY_ISO } from '../../data/cities/countryIds'
import type { SearchCountryId } from '../../data/cities/countryIds'
import { isAdminSession } from '../../utils/adminSession'
import { isOwnerDeleted } from '../../utils/deletedOwnersStore'
import {
  adminDeleteOwnerUser,
  formatDateDots,
  getAllOwnerProfilesForAdmin,
  type OwnerProfile,
} from '../../utils/ownerSession'
import {
  daysUntilSubscriptionEnd,
  filterByCountry,
  hasActiveSubscriptionWindow,
  matchesOwnerSearch,
} from '../../utils/subscriptionAdmin'

function planLabel(p: OwnerProfile, t: (k: string) => string): string {
  if (!p.plan) return '—'
  return t(`owner.planNames.${p.plan}`)
}

export function AdminExpiringPage() {
  const { t } = useTranslation()
  const [epoch, setEpoch] = useState(0)
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState<'all' | SearchCountryId>('all')
  const [contactModal, setContactModal] = useState<OwnerProfile | null>(null)

  const bump = useCallback(() => setEpoch((e) => e + 1), [])

  const base = useMemo(() => {
    void epoch
    return getAllOwnerProfilesForAdmin().filter(
      (p) => !isOwnerDeleted(p.userId) && hasActiveSubscriptionWindow(p),
    )
  }, [epoch])

  const filtered = useMemo(() => {
    const q = filterByCountry(base, country).filter((p) => matchesOwnerSearch(p, search))
    return q
  }, [base, country, search])

  const rows30 = useMemo(() => {
    return filtered
      .map((p) => ({ p, d: daysUntilSubscriptionEnd(p) }))
      .filter((x): x is { p: OwnerProfile; d: number } => x.d != null && x.d > 0 && x.d <= 30)
      .sort((a, b) => a.d - b.d)
  }, [filtered])

  const rows15 = useMemo(() => {
    return filtered
      .map((p) => ({ p, d: daysUntilSubscriptionEnd(p) }))
      .filter((x): x is { p: OwnerProfile; d: number } => x.d != null && x.d > 0 && x.d <= 15)
      .sort((a, b) => a.d - b.d)
  }, [filtered])

  const onDelete = (p: OwnerProfile) => {
    if (!window.confirm(t('admin.expiring.confirmDelete'))) return
    adminDeleteOwnerUser(p.userId)
    bump()
  }

  const onAutoContact = (p: OwnerProfile) => {
    const subj = encodeURIComponent(t('admin.expiring.mailSubject', { name: p.displayName }))
    const body = encodeURIComponent(
      t('admin.expiring.mailBody', { name: p.displayName, date: formatDateDots(p.validUntil) }),
    )
    window.location.href = `mailto:${encodeURIComponent(p.email)}?subject=${subj}&body=${body}`
  }

  const renderTable = (rows: { p: OwnerProfile; d: number }[], emptyKey: string) => (
    <div className="ra-admin-listings__table-wrap">
      <table className="ra-admin-listings__table">
        <thead>
          <tr>
            <th>{t('admin.expiring.colName')}</th>
            <th>{t('admin.expiring.colEmail')}</th>
            <th>{t('admin.expiring.colPhone')}</th>
            <th>{t('admin.expiring.colPlan')}</th>
            <th>{t('admin.expiring.colValidUntil')}</th>
            <th>{t('admin.expiring.colDaysLeft')}</th>
            <th>{t('admin.expiring.colActions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="ra-admin-listings__empty">
                {t(emptyKey)}
              </td>
            </tr>
          ) : (
            rows.map(({ p, d }) => (
              <tr key={p.userId}>
                <td>{p.displayName}</td>
                <td className="ra-admin-listings__mono">{p.email}</td>
                <td>{p.phone ?? '—'}</td>
                <td>{planLabel(p, t)}</td>
                <td>{formatDateDots(p.validUntil)}</td>
                <td>{d}</td>
                <td className="ra-admin-owners__actions-cell">
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
  )

  if (!isAdminSession()) return null

  return (
    <div className="ra-admin-expiring">
      <Helmet>
        <title>{t('admin.nav.expiring')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <header className="ra-admin-head">
        <h1 className="ra-admin-title">{t('admin.nav.expiring')}</h1>
        <p className="ra-admin-subtitle">{t('admin.expiring.lead')}</p>
      </header>

      <div className="ra-admin-toolbar ra-admin-expiring__toolbar">
        <label className="ra-fld ra-admin-expiring__search">
          <span>{t('admin.expiring.search')}</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('admin.expiring.searchPh')} />
        </label>
        <div className="ra-admin-expiring__countries" role="tablist" aria-label={t('admin.expiring.countryFilter')}>
          <button
            type="button"
            role="tab"
            className={`ra-admin-expiring__tab ${country === 'all' ? 'is-active' : ''}`}
            onClick={() => setCountry('all')}
          >
            {t('admin.expiring.allCountries')}
          </button>
          {SEARCH_COUNTRY_IDS.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              className={`ra-admin-expiring__tab ${country === c ? 'is-active' : ''}`}
              onClick={() => setCountry(c)}
            >
              {SEARCH_COUNTRY_ISO[c]}
            </button>
          ))}
        </div>
      </div>

      <section className="ra-admin-expiring__block" aria-labelledby="ex30">
        <h2 id="ex30" className="ra-admin-expiring__h2 ra-admin-expiring__h2--30">
          {t('admin.expiring.title30')}
        </h2>
        {renderTable(rows30, 'admin.expiring.empty30')}
      </section>

      <section className="ra-admin-expiring__block" aria-labelledby="ex15">
        <h2 id="ex15" className="ra-admin-expiring__h2 ra-admin-expiring__h2--15">
          {t('admin.expiring.title15')}
        </h2>
        {renderTable(rows15, 'admin.expiring.empty15')}
      </section>

      {contactModal && (
        <div className="ra-modal" role="dialog" aria-modal aria-labelledby="exp-contact-h" onClick={() => setContactModal(null)}>
          <div className="ra-modal__panel ra-admin-owners__modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="exp-contact-h" className="ra-modal__title">
              {t('admin.expiring.contactTitle')}
            </h2>
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
