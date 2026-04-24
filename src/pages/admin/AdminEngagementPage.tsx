import { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { AdminCountryChips } from '../../components/admin/AdminCountryChips'
import { fetchAdminOwnersProfiles, sendAdminOwnerEmail } from '../../lib/adminOwnersApi'
import { isAdminSession } from '../../utils/adminSession'
import { shortOwnerId } from '../../utils/ownerDisplayId'
import type { OwnerProfile } from '../../utils/ownerSession'
import {
  type CountryFilterState,
  filterByCountrySet,
  matchesOwnerSearch,
} from '../../utils/subscriptionAdmin'

function ymNow(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function AdminEngagementPage() {
  const { t } = useTranslation()
  const [profiles, setProfiles] = useState<OwnerProfile[]>([])
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState<CountryFilterState>('all')
  const [detailsOwner, setDetailsOwner] = useState<string | null>(null)
  const [server, setServer] = useState<{
    ym: string
    totalContacts: number
    owners: Array<{ ownerUserId: string; views: number; contacts: number; byListing: Array<{ listingId: string; views: number; contacts: number }> }>
  } | null>(null)

  const ym = ymNow()

  const reloadOwners = useCallback(async () => {
    const list = await fetchAdminOwnersProfiles()
    if (!list) {
      setLoadError(true)
      setProfiles([])
      return
    }
    setLoadError(false)
    setProfiles(list)
  }, [])

  const mapByOwner = useMemo(() => {
    const m = new Map<string, { views: number; contacts: number; byListing: Array<{ listingId: string; views: number; contacts: number }> }>()
    if (!server?.owners) return m
    for (const o of server.owners) {
      m.set(o.ownerUserId, { views: o.views, contacts: o.contacts, byListing: o.byListing })
    }
    return m
  }, [server])

  useEffect(() => {
    void reloadOwners()
  }, [reloadOwners])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch(`/api/admin-engagement?ym=${encodeURIComponent(ym)}`, { credentials: 'include' })
        const j = (await r.json()) as {
          ok?: boolean
          ym?: string
          totalContacts?: number
          owners?: Array<{ ownerUserId: string; views: number; contacts: number; byListing: Array<{ listingId: string; views: number; contacts: number }> }>
        }
        if (!cancelled && r.ok && j.ok && j.ym === ym && Array.isArray(j.owners)) {
          setServer({ ym, totalContacts: Number(j.totalContacts) || 0, owners: j.owners })
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ym])

  const rows = useMemo(() => {
    const fc = filterByCountrySet(profiles, country).filter((p) => matchesOwnerSearch(p, search))
    return fc
      .map((p) => {
        const m = mapByOwner.get(p.userId.trim().toLowerCase())
        const views = m?.views ?? 0
        const contacts = m?.contacts ?? 0
        return { p, views, contacts }
      })
      .sort((a, b) => b.views + b.contacts - (a.views + a.contacts))
  }, [profiles, mapByOwner, country, search])

  const totalClicksMonth = server?.totalContacts ?? 0

  const sendReportMail = () => {
    window.alert(t('admin.engagement.mailDisabled'))
  }

  const sendMailOwner = async (row: { p: { displayName: string; email: string }; views: number; contacts: number }) => {
    const ok = await sendAdminOwnerEmail({
      toEmail: row.p.email,
      toName: row.p.displayName,
      subject: t('admin.engagement.ownerMailSubject', { name: row.p.displayName }),
      message: t('admin.engagement.ownerMailBody', {
        name: row.p.displayName,
        email: row.p.email,
        views: row.views,
        contacts: row.contacts,
        ym,
      }),
    })
    if (ok) window.alert(t('admin.engagement.mailSent'))
    else window.alert(t('admin.engagement.mailSendError', { detail: 'network' }))
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
        {loadError ? <p className="ra-admin-listings__hint">{t('admin.engagement.loadError')}</p> : null}
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
                <>
                <tr key={p.userId}>
                  <td className="ra-admin-listings__mono">{shortOwnerId(p.userId)}</td>
                  <td>
                    <button
                      type="button"
                      className="ra-admin-owner-msg__link"
                      onClick={() => setDetailsOwner((cur) => (cur === p.userId ? null : p.userId))}
                    >
                      {p.displayName}
                    </button>
                  </td>
                  <td className="ra-admin-listings__mono">{p.email}</td>
                  <td>{views}</td>
                  <td>{contacts}</td>
                  <td>
                    <button type="button" className="ra-btn ra-btn--sm" onClick={() => void sendMailOwner({ p, views, contacts })}>
                      {t('admin.engagement.btnMailOwner')}
                    </button>
                  </td>
                </tr>
                {detailsOwner === p.userId && (
                  <tr key={`${p.userId}__details`}>
                    <td colSpan={6}>
                      <div className="ra-admin-engagement__details">
                        <strong>{t('admin.engagement.detailsTitle', { ym })}</strong>
                        <div className="ra-admin-engagement__details-grid">
                          {(mapByOwner.get(p.userId.trim().toLowerCase())?.byListing ?? []).map((x) => (
                            <div key={x.listingId} className="ra-admin-engagement__details-row">
                              <span className="ra-admin-listings__mono">{x.listingId}</span>
                              <span>{t('admin.engagement.detailsViews', { n: x.views })}</span>
                              <span>{t('admin.engagement.detailsContacts', { n: x.contacts })}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
