import { useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { AdminCountryChips } from '../../components/admin/AdminCountryChips'
import { isAdminSession } from '../../utils/adminSession'
import { getMonthContactAggregate } from '../../utils/adminEngagementStore'
import { isOwnerDeleted } from '../../utils/deletedOwnersStore'
import { shortOwnerId } from '../../utils/ownerDisplayId'
import { getAllOwnerProfilesForAdmin, getOwnerListings } from '../../utils/ownerSession'
import {
  type CountryFilterState,
  filterByCountrySet,
  matchesOwnerSearch,
} from '../../utils/subscriptionAdmin'

const REPORT_FROM = 'info@rentadria.com'

function ymNow(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function AdminEngagementPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState<CountryFilterState>('all')

  const ym = ymNow()
  const monthAgg = getMonthContactAggregate(ym)

  const rows = useMemo(() => {
    const owners = getAllOwnerProfilesForAdmin().filter((p) => !isOwnerDeleted(p.userId))
    const fc = filterByCountrySet(owners, country).filter((p) => matchesOwnerSearch(p, search))
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
          `${r.p.displayName} | ${r.p.email} | views: ${r.views} | contact clicks: ${r.contacts}`,
      )
    const body = encodeURIComponent(
      [`From: ${REPORT_FROM}`, '', t('admin.engagement.mailIntro', { ym, total: totalClicksMonth }), '', ...lines].join(
        '\n',
      ),
    )
    window.location.href = `mailto:${encodeURIComponent(REPORT_FROM)}?subject=${encodeURIComponent(t('admin.engagement.mailSubject', { ym }))}&body=${body}`
  }

  const mailtoOwner = (row: { p: { displayName: string; email: string }; views: number; contacts: number }) => {
    const subj = encodeURIComponent(t('admin.engagement.ownerMailSubject', { name: row.p.displayName }))
    const body = encodeURIComponent(
      t('admin.engagement.ownerMailBody', {
        name: row.p.displayName,
        email: row.p.email,
        views: row.views,
        contacts: row.contacts,
        ym,
      }),
    )
    window.location.href = `mailto:${encodeURIComponent(row.p.email)}?subject=${subj}&body=${body}`
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
        <AdminCountryChips value={country} onChange={setCountry} allLabel={t('admin.expiring.allCountries')} />
      </div>

      <div className="ra-admin-listings__table-wrap">
        <table className="ra-admin-listings__table">
          <thead>
            <tr>
              <th>{t('admin.engagement.colIdShort')}</th>
              <th>{t('admin.engagement.colOwner')}</th>
              <th>{t('admin.engagement.colEmail')}</th>
              <th>{t('admin.engagement.colViews')}</th>
              <th>{t('admin.engagement.colContacts')}</th>
              <th>{t('admin.engagement.colMail')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="ra-admin-listings__empty">
                  {t('admin.engagement.empty')}
                </td>
              </tr>
            ) : (
              rows.map(({ p, views, contacts }) => (
                <tr key={p.userId}>
                  <td className="ra-admin-listings__mono">{shortOwnerId(p.userId)}</td>
                  <td>{p.displayName}</td>
                  <td className="ra-admin-listings__mono">{p.email}</td>
                  <td>{views}</td>
                  <td>{contacts}</td>
                  <td>
                    <button type="button" className="ra-btn ra-btn--sm" onClick={() => mailtoOwner({ p, views, contacts })}>
                      {t('admin.engagement.btnMailOwner')}
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
