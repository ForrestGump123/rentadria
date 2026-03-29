import { useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { SEARCH_COUNTRY_IDS, SEARCH_COUNTRY_ISO } from '../../data/cities/countryIds'
import type { SearchCountryId } from '../../data/cities/countryIds'
import { isAdminSession } from '../../utils/adminSession'
import { getMonthContactAggregate } from '../../utils/adminEngagementStore'
import { isOwnerDeleted } from '../../utils/deletedOwnersStore'
import { getAllOwnerProfilesForAdmin, getOwnerListings } from '../../utils/ownerSession'
import { filterByCountry, matchesOwnerSearch } from '../../utils/subscriptionAdmin'

function ymNow(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function AdminEngagementPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState<'all' | SearchCountryId>('all')

  const ym = ymNow()
  const monthAgg = getMonthContactAggregate(ym)

  const rows = useMemo(() => {
    const owners = getAllOwnerProfilesForAdmin().filter((p) => !isOwnerDeleted(p.userId))
    const fc = filterByCountry(owners, country).filter((p) => matchesOwnerSearch(p, search))
    return fc
      .map((p) => {
        const listings = getOwnerListings(p.userId)
        const views = listings.reduce((s, x) => s + (x.viewsMonth ?? 0), 0)
        const contacts = listings.reduce((s, x) => s + (x.contactClicksMonth ?? 0), 0)
        return { p, views, contacts }
      })
      .sort((a, b) => b.views + b.contacts - (a.views + a.contacts))
  }, [country, search])

  const totalClicksMonth = monthAgg.contactClicks

  const sendReportMail = () => {
    const lines = rows
      .filter((r) => r.views > 0 || r.contacts > 0)
      .map(
        (r) =>
          `${r.p.displayName} | ${r.p.email} | pregledi: ${r.views} | kontakt klikovi: ${r.contacts}`,
      )
    const body = encodeURIComponent(
      [
        t('admin.engagement.mailIntro', { ym, total: totalClicksMonth }),
        '',
        ...lines,
      ].join('\n'),
    )
    window.location.href = `mailto:?subject=${encodeURIComponent(t('admin.engagement.mailSubject', { ym }))}&body=${body}`
  }

  if (!isAdminSession()) return null

  return (
    <div className="ra-admin-expiring">
      <Helmet>
        <title>{t('admin.nav.engagement')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <header className="ra-admin-head">
        <h1 className="ra-admin-title">{t('admin.nav.engagement')}</h1>
        <p className="ra-admin-subtitle">{t('admin.engagement.lead')}</p>
        <p className="ra-admin-engagement__month">
          {t('admin.engagement.monthTotal', { ym, n: totalClicksMonth })}
        </p>
        <button type="button" className="ra-btn ra-btn--primary ra-admin-engagement__mail" onClick={sendReportMail}>
          {t('admin.engagement.btnMailReport')}
        </button>
      </header>

      <div className="ra-admin-toolbar ra-admin-expiring__toolbar">
        <label className="ra-fld ra-admin-expiring__search">
          <span>{t('admin.engagement.search')}</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('admin.engagement.searchPh')} />
        </label>
        <div className="ra-admin-expiring__countries">
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
              <th>{t('admin.engagement.colOwner')}</th>
              <th>{t('admin.engagement.colEmail')}</th>
              <th>{t('admin.engagement.colViews')}</th>
              <th>{t('admin.engagement.colContacts')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="ra-admin-listings__empty">
                  {t('admin.engagement.empty')}
                </td>
              </tr>
            ) : (
              rows.map(({ p, views, contacts }) => (
                <tr key={p.userId}>
                  <td>{p.displayName}</td>
                  <td className="ra-admin-listings__mono">{p.email}</td>
                  <td>{views}</td>
                  <td>{contacts}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
