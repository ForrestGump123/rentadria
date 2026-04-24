import { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { AdminCountryChips } from '../../components/admin/AdminCountryChips'
import {
  fetchAdminOwnersProfiles,
  postAdminOwnerUpdate,
  sendAdminOwnerEmail,
  softDeleteOwnerOnServer,
} from '../../lib/adminOwnersApi'
import { isAdminSession } from '../../utils/adminSession'
import { addOneYearIso, formatDateDots, type OwnerProfile } from '../../utils/ownerSession'
import {
  type CountryFilterState,
  filterByCountrySet,
  isSubscriptionDateExpired,
  matchesOwnerSearch,
} from '../../utils/subscriptionAdmin'

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
  const [profiles, setProfiles] = useState<OwnerProfile[]>([])
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState<CountryFilterState>('all')
  const [contactModal, setContactModal] = useState<OwnerProfile | null>(null)

  const reload = useCallback(async () => {
    const list = await fetchAdminOwnersProfiles()
    if (list === null) {
      setLoadError(true)
      setProfiles([])
      return
    }
    setLoadError(false)
    setProfiles(list)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const rows = useMemo(() => {
    const list = profiles.filter((p) => p.plan != null && isSubscriptionDateExpired(p))
    return filterByCountrySet(list, country)
      .filter((p) => matchesOwnerSearch(p, search))
      .map((p) => ({ p, days: daysSinceExpiry(p) }))
      .sort((a, b) => b.days - a.days)
  }, [profiles, country, search])

  const onRenew = (p: OwnerProfile) => {
    if (!window.confirm(t('admin.paused.confirmRenew'))) return
    void (async () => {
      const res = await postAdminOwnerUpdate({
        userId: p.userId,
        displayName: p.displayName,
        email: p.email,
        phone: p.phone ?? null,
        countryId: p.countryId ?? null,
        passwordHash: p.passwordHash ?? null,
        plan: p.plan,
        subscriptionActive: true,
        validUntil: addOneYearIso(),
        basicCategoryChoice: p.basicCategoryChoice ?? null,
        adminMeta: {},
      })
      if (!res.ok) window.alert(t('admin.paused.renewError', { detail: res.error ?? '?' }))
      await reload()
    })()
  }

  const onDelete = (p: OwnerProfile) => {
    if (!window.confirm(t('admin.owners.confirmSoftDelete'))) return
    void (async () => {
      const res = await softDeleteOwnerOnServer(p.userId)
      if (!res.ok) {
        window.alert(t('admin.paused.deleteError', { detail: res.error ?? '?' }))
        return
      }
      await reload()
    })()
  }

  const onAutoContact = (p: OwnerProfile) => {
    void (async () => {
      const subject = t('admin.paused.mailSubject', { name: p.displayName })
      const message = t('admin.paused.mailBody', {
        name: p.displayName,
        date: formatDateDots(p.validUntil),
      })
      const ok = await sendAdminOwnerEmail({
        toEmail: p.email,
        toName: p.displayName,
        subject,
        message,
      })
      if (ok) window.alert(t('admin.paused.emailSent'))
      else window.alert(t('admin.paused.emailFail'))
    })()
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
        {loadError ? <p className="ra-admin-listings__hint">{t('admin.paused.loadError')}</p> : null}
      </header>

      <div className="ra-admin-toolbar ra-admin-expiring__toolbar">
        <label className="ra-fld ra-admin-expiring__search">
          <span>{t('admin.paused.search')}</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('admin.paused.searchPh')} />
        </label>
        <AdminCountryChips value={country} onChange={setCountry} allLabel={t('admin.expiring.allCountries')} />
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
        <div className="ra-modal" role="dialog" aria-modal aria-labelledby="paused-contact-h" onClick={() => setContactModal(null)}>
          <div className="ra-modal__panel ra-admin-owners__modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="paused-contact-h" className="ra-modal__title">
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
