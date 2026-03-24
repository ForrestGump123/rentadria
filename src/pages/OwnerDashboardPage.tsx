import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Navigate, NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import type { ListingCategory } from '../types'
import { isLoggedIn } from '../utils/storage'
import { CategoryPickerModal } from '../components/owner/CategoryPickerModal'

const AccommodationListingModal = lazy(() =>
  import('../components/owner/AccommodationListingModal').then((m) => ({ default: m.AccommodationListingModal })),
)
import {
  clearOwnerSession,
  deleteOwnerListing,
  displayFirstName,
  formatDateDots,
  getOwnerListings,
  getOwnerProfile,
  getUnlockedCategories,
  type OwnerListingRow,
} from '../utils/ownerSession'

const CAT_ORDER: ListingCategory[] = ['accommodation', 'car', 'motorcycle']

export function OwnerDashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [profile] = useState(() => getOwnerProfile())
  const [listVersion, setListVersion] = useState(0)
  const [activeCat, setActiveCat] = useState<ListingCategory>(() => {
    const p = getOwnerProfile()
    const unlocked: ListingCategory[] = p ? getUnlockedCategories(p.plan) : ['accommodation']
    return unlocked[0] ?? 'accommodation'
  })
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [accommodationModalOpen, setAccommodationModalOpen] = useState(false)

  const reload = useCallback(() => setListVersion((v) => v + 1), [])

  const listings = useMemo(() => {
    if (!profile) return []
    return getOwnerListings(profile.userId)
  }, [profile, listVersion])

  const unlocked = useMemo(
    () => (profile ? getUnlockedCategories(profile.plan) : []),
    [profile],
  )

  const filtered = useMemo(
    () => listings.filter((l) => l.category === activeCat),
    [listings, activeCat],
  )

  const stats = useMemo(() => {
    const views = filtered.reduce((s, x) => s + x.viewsMonth, 0)
    const contacts = filtered.reduce((s, x) => s + x.contactClicksMonth, 0)
    return { views, contacts, inquiries: 0 }
  }, [filtered])

  const onDelete = useCallback(
    (row: OwnerListingRow) => {
      if (!profile) return
      if (!window.confirm(t('owner.confirmDelete'))) return
      deleteOwnerListing(profile.userId, row.id)
      reload()
    },
    [profile, t, reload],
  )

  const onLogout = useCallback(() => {
    clearOwnerSession()
    navigate('/', { replace: true })
  }, [navigate])

  if (!isLoggedIn() || !profile) {
    return <Navigate to="/" replace />
  }

  const firstName = displayFirstName(profile.displayName)
  const planLabel = t(`pricing.planNames.${profile.plan}`)
  const planSummary = t(`owner.planSummary.${profile.plan}`)

  return (
    <div className="ra-app ra-owner-with-chrome">
      <Helmet>
        <title>{t('owner.pageTitle')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <Header category="accommodation" onCategory={(c) => navigate(`/?cat=${c}`)} />

      <div className="ra-owner-app">
      <aside className="ra-owner-sidebar" aria-label={t('owner.sidebarAria')}>
        <nav className="ra-owner-nav">
          <NavLink end className={({ isActive }) => `ra-owner-nav__link ${isActive ? 'is-active' : ''}`} to="/owner">
            <span className="ra-owner-nav__ico" aria-hidden>
              📊
            </span>
            {t('owner.nav.overview')}
          </NavLink>
          <span className="ra-owner-nav__link ra-owner-nav__link--disabled" title={t('owner.soon')}>
            <span className="ra-owner-nav__ico" aria-hidden>
              💬
            </span>
            {t('owner.nav.inquiries')}
          </span>
          <span className="ra-owner-nav__link ra-owner-nav__link--disabled" title={t('owner.soon')}>
            <span className="ra-owner-nav__ico" aria-hidden>
              ✉️
            </span>
            {t('owner.nav.messages')}
          </span>
          <span className="ra-owner-nav__link ra-owner-nav__link--disabled" title={t('owner.soon')}>
            <span className="ra-owner-nav__ico" aria-hidden>
              📣
            </span>
            {t('owner.nav.ads')}
          </span>
          <span className="ra-owner-nav__link ra-owner-nav__link--disabled" title={t('owner.soon')}>
            <span className="ra-owner-nav__ico" aria-hidden>
              💭
            </span>
            {t('owner.nav.forum')}
          </span>
          <span className="ra-owner-nav__link ra-owner-nav__link--disabled" title={t('owner.soon')}>
            <span className="ra-owner-nav__ico" aria-hidden>
              🏷️
            </span>
            {t('owner.nav.enterCode')}
          </span>
          <span className="ra-owner-nav__link ra-owner-nav__link--disabled" title={t('owner.soon')}>
            <span className="ra-owner-nav__ico" aria-hidden>
              ⚙️
            </span>
            {t('owner.nav.settings')}
          </span>
          <span className="ra-owner-nav__link ra-owner-nav__link--disabled" title={t('owner.soon')}>
            <span className="ra-owner-nav__ico" aria-hidden>
              👤
            </span>
            {t('owner.nav.editProfile')}
          </span>
        </nav>
        <button type="button" className="ra-owner-sidebar__logout" onClick={onLogout}>
          {t('nav.logout')}
        </button>
      </aside>

      <main className="ra-owner-main">
        <header className="ra-owner-head">
          <div>
            <h1 className="ra-owner-welcome">{t('owner.welcome', { name: firstName })}</h1>
            <p className="ra-owner-lead">{t('owner.lead')}</p>
            <p className="ra-owner-plan">
              <span className="ra-owner-plan__badge">{planLabel}</span>
              <span className="ra-owner-plan__summary">{planSummary}</span>
            </p>
          </div>
          <button
            type="button"
            className="ra-btn ra-btn--primary"
            onClick={() => {
              if (unlocked.length === 1) {
                const only = unlocked[0]
                if (only === 'accommodation') setAccommodationModalOpen(true)
                else window.alert(t('owner.soon'))
              } else {
                setCategoryPickerOpen(true)
              }
            }}
          >
            {t('owner.newListing')}
          </button>
        </header>

        <div className="ra-owner-banner" role="status">
          {t('owner.datesBanner', {
            registered: formatDateDots(profile.registeredAt),
            validUntil: formatDateDots(profile.validUntil),
          })}
        </div>

        <div className="ra-owner-tabs" role="tablist" aria-label={t('owner.categoriesAria')}>
          {CAT_ORDER.filter((c) => unlocked.includes(c)).map((c) => {
            const active = activeCat === c
            return (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={active}
                className={`ra-owner-tab ${active ? 'ra-owner-tab--active' : ''}`}
                onClick={() => setActiveCat(c)}
              >
                <span className="ra-owner-tab__ico" aria-hidden>
                  {c === 'accommodation' ? '🏠' : c === 'car' ? '🚗' : '🏍️'}
                </span>
                {t(`nav.${c}`)}
                <span className="ra-owner-tab__check" aria-hidden>
                  ✓
                </span>
              </button>
            )
          })}
        </div>

        <section className="ra-owner-stats" aria-labelledby="owner-stats-h">
          <h2 id="owner-stats-h" className="ra-owner-stats__title">
            {t('owner.statsTitle')}
          </h2>
          <div className="ra-owner-stats__grid">
            <div className="ra-owner-stat ra-owner-stat--views">
              <strong>{stats.views}</strong>
              <span>{t('owner.statsViews')}</span>
            </div>
            <div className="ra-owner-stat ra-owner-stat--contacts">
              <strong>{stats.contacts}</strong>
              <span>{t('owner.statsContacts')}</span>
            </div>
            <div className="ra-owner-stat ra-owner-stat--inquiries">
              <strong>{stats.inquiries}</strong>
              <span>{t('owner.statsInquiries')}</span>
            </div>
          </div>
        </section>

        <section className="ra-owner-table-section" aria-labelledby="owner-table-h">
          <div className="ra-owner-table-head">
            <h2 id="owner-table-h" className="ra-owner-table-section__title">
              {t('owner.tableTitle', { category: t(`nav.${activeCat}`) })}
            </h2>
          </div>

          <div className="ra-owner-table-wrap">
            <table className="ra-owner-table">
              <thead>
                <tr>
                  <th>{t('owner.colTitle')}</th>
                  <th>{t('owner.colViews')}</th>
                  <th>{t('owner.colContacts')}</th>
                  <th>{t('owner.colDates')}</th>
                  <th>{t('owner.colFeatured')}</th>
                  <th>{t('owner.colNote')}</th>
                  <th>{t('owner.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="ra-owner-table__empty">
                      {t('owner.emptyCategory')}
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id}>
                      <td>{row.title}</td>
                      <td>{row.viewsMonth}</td>
                      <td>{row.contactClicksMonth}</td>
                      <td>
                        {row.receivedAt} / {row.expiresAt}
                      </td>
                      <td>{row.featuredUntil ?? '—'}</td>
                      <td>{row.internalNote ?? '—'}</td>
                      <td className="ra-owner-table__actions">
                        {row.publicListingId ? (
                          <button
                            type="button"
                            className="ra-btn ra-btn--ghost ra-btn--sm"
                            onClick={() => navigate(`/listing/${row.publicListingId}`)}
                          >
                            {t('owner.actionView')}
                          </button>
                        ) : (
                          <span className="ra-owner-table__muted">—</span>
                        )}
                        <button
                          type="button"
                          className="ra-btn ra-btn--primary ra-btn--sm"
                          disabled
                          title={t('owner.soon')}
                        >
                          {t('owner.actionEdit')}
                        </button>
                        <button
                          type="button"
                          className="ra-btn ra-btn--danger ra-btn--sm"
                          onClick={() => onDelete(row)}
                        >
                          {t('owner.actionDelete')}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <p className="ra-owner-privacy">{t('owner.privacyNote')}</p>
      </main>
      </div>

      <Footer />

      <CategoryPickerModal
        open={categoryPickerOpen}
        onClose={() => setCategoryPickerOpen(false)}
        unlocked={unlocked}
        onPick={(c) => {
          if (c === 'accommodation') setAccommodationModalOpen(true)
          else window.alert(t('owner.soon'))
        }}
      />

      {profile && accommodationModalOpen && (
        <Suspense
          fallback={
            <div className="ra-modal" style={{ zIndex: 130 }} role="status" aria-live="polite">
              <div className="ra-modal__panel" style={{ padding: '1.5rem' }}>
                {t('owner.listing.loading')}
              </div>
            </div>
          }
        >
          <AccommodationListingModal
            open
            onClose={() => setAccommodationModalOpen(false)}
            profile={profile}
          />
        </Suspense>
      )}
    </div>
  )
}
