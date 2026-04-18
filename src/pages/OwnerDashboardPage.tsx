import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getPricingPlans, resolvePlanForSubscription } from '../content/pricingPlans'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import type { ListingCategory } from '../types'
import { isLoggedIn } from '../utils/storage'
import { CategoryPickerModal } from '../components/owner/CategoryPickerModal'

const AccommodationListingModal = lazy(() =>
  import('../components/owner/AccommodationListingModal').then((m) => ({ default: m.AccommodationListingModal })),
)
import { getSavedPromoCode } from '../utils/ownerPromoCode'
import {
  activateOwnerSubscription,
  clearOwnerSession,
  deleteOwnerListing,
  displayFirstName,
  formatDateDots,
  getEffectiveUnlockedCategories,
  getOwnerListings,
  getOwnerProfile,
  saveBasicCategoryChoice,
  type OwnerListingRow,
} from '../utils/ownerSession'
import { getAdminOwnerMeta } from '../utils/adminOwnerMeta'
import { pullOwnerListingsFromCloud } from '../lib/ownerCloudSync'
import { pullOwnerProfileFromCloud } from '../lib/ownerProfileCloud'
import { getUnreadThreadCountForOwner } from '../utils/ownerAdminMessages'
import { countInquiriesThisMonth, getInquiryUnreadCount } from '../utils/visitorInquiries'
import { OwnerEditProfilePage } from './owner/OwnerEditProfilePage'
import { OwnerSettingsPage } from './owner/OwnerSettingsPage'
import { OwnerInquiriesPage } from './owner/OwnerInquiriesPage'
import { OwnerMessagesPage } from './owner/OwnerMessagesPage'
import { OwnerAdsPage } from './owner/OwnerAdsPage'
import { OwnerForumPage } from './owner/OwnerForumPage'
import { OwnerCodePage } from './owner/OwnerCodePage'

const CAT_ORDER: ListingCategory[] = ['accommodation', 'car', 'motorcycle']

export function OwnerDashboardPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [sessionEpoch, setSessionEpoch] = useState(0)
  const [listVersion, setListVersion] = useState(0)
  const [activeCat, setActiveCat] = useState<ListingCategory>('accommodation')
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [accommodationModalOpen, setAccommodationModalOpen] = useState(false)
  const [listingModalCategory, setListingModalCategory] = useState<'accommodation' | 'car' | 'motorcycle'>(
    'accommodation',
  )
  const [acmodalEditingRowId, setAcmodalEditingRowId] = useState<string | null>(null)
  const [inquiryEpoch, setInquiryEpoch] = useState(0)
  const [inquiryUnread, setInquiryUnread] = useState(0)
  const [msgUnread, setMsgUnread] = useState(0)
  const [mobileOwnerNavOpen, setMobileOwnerNavOpen] = useState(false)

  useEffect(() => {
    setMobileOwnerNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileOwnerNavOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOwnerNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOwnerNavOpen])

  useEffect(() => {
    const onAuth = () => setSessionEpoch((e) => e + 1)
    window.addEventListener('rentadria-auth', onAuth)
    return () => window.removeEventListener('rentadria-auth', onAuth)
  }, [])

  useEffect(() => {
    const onInv = () => setInquiryEpoch((e) => e + 1)
    window.addEventListener('rentadria-inquiries-updated', onInv)
    return () => window.removeEventListener('rentadria-inquiries-updated', onInv)
  }, [])

  const profile = useMemo(
    () => (isLoggedIn() ? getOwnerProfile() : null),
    [sessionEpoch],
  )

  useEffect(() => {
    if (!profile?.userId) return
    let cancelled = false
    void (async () => {
      const [listOk] = await Promise.all([
        pullOwnerListingsFromCloud(profile.userId),
        pullOwnerProfileFromCloud(profile.userId),
      ])
      if (!cancelled && listOk) setListVersion((v) => v + 1)
    })()
    return () => {
      cancelled = true
    }
  }, [profile?.userId, sessionEpoch])

  useEffect(() => {
    const syncUnread = () => {
      if (profile) setInquiryUnread(getInquiryUnreadCount(profile.userId))
    }
    syncUnread()
    window.addEventListener('rentadria-inquiry-dashboard-notify', syncUnread)
    window.addEventListener('rentadria-inquiry-unread-changed', syncUnread)
    return () => {
      window.removeEventListener('rentadria-inquiry-dashboard-notify', syncUnread)
      window.removeEventListener('rentadria-inquiry-unread-changed', syncUnread)
    }
  }, [profile])

  useEffect(() => {
    const syncMsg = () => {
      if (profile) setMsgUnread(getUnreadThreadCountForOwner(profile.userId))
    }
    syncMsg()
    window.addEventListener('rentadria-owner-messages-unread-changed', syncMsg)
    return () => window.removeEventListener('rentadria-owner-messages-unread-changed', syncMsg)
  }, [profile])

  const reload = useCallback(() => setListVersion((v) => v + 1), [])
  const refreshProfile = useCallback(() => setSessionEpoch((e) => e + 1), [])

  const listings = useMemo(() => {
    if (!profile) return []
    return getOwnerListings(profile.userId)
  }, [profile, listVersion])

  const unlocked = useMemo(
    () => (profile ? getEffectiveUnlockedCategories(profile) : []),
    [profile],
  )

  const pricingPlans = useMemo(() => getPricingPlans(i18n.language), [i18n.language])

  useEffect(() => {
    if (!unlocked.length) return
    if (!unlocked.includes(activeCat)) {
      setActiveCat(unlocked[0]!)
    }
  }, [unlocked, activeCat])

  const filtered = useMemo(
    () => listings.filter((l) => l.category === activeCat),
    [listings, activeCat],
  )

  const stats = useMemo(() => {
    const views = filtered.reduce((s, x) => s + x.viewsMonth, 0)
    const contacts = filtered.reduce((s, x) => s + x.contactClicksMonth, 0)
    const inquiries = profile ? countInquiriesThisMonth(profile.userId) : 0
    return { views, contacts, inquiries }
  }, [filtered, profile, inquiryEpoch])

  const codeNavBadge = useMemo(() => {
    if (!profile) return 0
    const ready = profile.subscriptionActive === true && profile.plan != null
    if (ready) return 0
    return getSavedPromoCode(profile.userId) ? 0 : 1
  }, [profile, sessionEpoch])

  const ownerOverviewBadge = inquiryUnread + msgUnread + codeNavBadge

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
  const subscriptionReady = profile.subscriptionActive === true && profile.plan != null
  const blocked = getAdminOwnerMeta(profile.userId).blocked
  const onMessagesRoute =
    location.pathname === '/owner/messages' || location.pathname.startsWith('/owner/messages/')
  const pathSegments = location.pathname.split('/').filter(Boolean)
  if (blocked && !onMessagesRoute) {
    return <Navigate to="/owner/messages" replace />
  }
  if (!blocked && !subscriptionReady && pathSegments.length > 1) {
    return <Navigate to="/owner" replace />
  }
  const needsBasicCategory =
    subscriptionReady &&
    profile.plan === 'basic' &&
    (profile.basicCategoryChoice === undefined ||
      profile.basicCategoryChoice === null)

  const planLabel = profile.plan ? t(`pricing.planNames.${profile.plan}`) : '—'
  const planSummary = profile.plan ? t(`owner.planSummary.${profile.plan}`) : ''

  return (
    <div className="ra-app ra-owner-with-chrome">
      <Helmet>
        <title>{t('owner.pageTitle')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <Header category="accommodation" onCategory={(c) => navigate(`/?cat=${c}`)} />

      <div className="ra-owner-app">
      <aside className="ra-owner-sidebar" aria-label={t('owner.sidebarAria')}>
        <button
          type="button"
          id="ra-owner-nav-trigger"
          className="ra-owner-mobile-nav-trigger"
          aria-expanded={mobileOwnerNavOpen}
          aria-controls="ra-owner-nav"
          aria-label={mobileOwnerNavOpen ? t('owner.mobileNav.collapse') : t('owner.mobileNav.expand')}
          onClick={() => setMobileOwnerNavOpen((o) => !o)}
        >
          <span>{t('owner.mobileNav.trigger')}</span>
          <span className="ra-owner-mobile-nav-trigger__chev" aria-hidden>
            {mobileOwnerNavOpen ? '▲' : '▼'}
          </span>
        </button>
        <nav
          id="ra-owner-nav"
          className={`ra-owner-nav ${mobileOwnerNavOpen ? 'is-open' : ''}`}
          aria-labelledby="ra-owner-nav-trigger"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a[href]')) setMobileOwnerNavOpen(false)
          }}
        >
          {blocked ? (
            <NavLink
              className={({ isActive }) => `ra-owner-nav__link ${isActive ? 'is-active' : ''}`}
              to="/owner/messages"
            >
              <span className="ra-owner-nav__ico" aria-hidden>
                ✉️
              </span>
              {t('owner.nav.messages')}
              {msgUnread > 0 && (
                <span className="ra-owner-nav__badge" aria-label={String(msgUnread)}>
                  {msgUnread > 99 ? '99+' : msgUnread}
                </span>
              )}
            </NavLink>
          ) : (
            <>
              <NavLink end className={({ isActive }) => `ra-owner-nav__link ${isActive ? 'is-active' : ''}`} to="/owner">
                <span className="ra-owner-nav__ico" aria-hidden>
                  📊
                </span>
                {t('owner.nav.overview')}
                {ownerOverviewBadge > 0 && (
                  <span className="ra-owner-nav__badge" aria-label={String(ownerOverviewBadge)}>
                    {ownerOverviewBadge > 99 ? '99+' : ownerOverviewBadge}
                  </span>
                )}
              </NavLink>
              <NavLink
                className={({ isActive }) => `ra-owner-nav__link ${isActive ? 'is-active' : ''}`}
                to="/owner/inquiries"
              >
                <span className="ra-owner-nav__ico" aria-hidden>
                  💬
                </span>
                {t('owner.nav.inquiries')}
                {inquiryUnread > 0 && (
                  <span className="ra-owner-nav__badge" aria-label={String(inquiryUnread)}>
                    {inquiryUnread > 99 ? '99+' : inquiryUnread}
                  </span>
                )}
              </NavLink>
              <NavLink
                className={({ isActive }) => `ra-owner-nav__link ${isActive ? 'is-active' : ''}`}
                to="/owner/messages"
              >
                <span className="ra-owner-nav__ico" aria-hidden>
                  ✉️
                </span>
                {t('owner.nav.messages')}
                {msgUnread > 0 && (
                  <span className="ra-owner-nav__badge" aria-label={String(msgUnread)}>
                    {msgUnread > 99 ? '99+' : msgUnread}
                  </span>
                )}
              </NavLink>
              <NavLink
                className={({ isActive }) => `ra-owner-nav__link ${isActive ? 'is-active' : ''}`}
                to="/owner/ads"
              >
                <span className="ra-owner-nav__ico" aria-hidden>
                  📣
                </span>
                {t('owner.nav.ads')}
              </NavLink>
              <NavLink
                className={({ isActive }) => `ra-owner-nav__link ${isActive ? 'is-active' : ''}`}
                to="/owner/forum"
              >
                <span className="ra-owner-nav__ico" aria-hidden>
                  💭
                </span>
                {t('owner.nav.forum')}
              </NavLink>
              <NavLink
                className={({ isActive }) => `ra-owner-nav__link ${isActive ? 'is-active' : ''}`}
                to="/owner/code"
              >
                <span className="ra-owner-nav__ico" aria-hidden>
                  🏷️
                </span>
                {t('owner.nav.enterCode')}
                {codeNavBadge > 0 && (
                  <span className="ra-owner-nav__badge" aria-label={String(codeNavBadge)}>
                    {codeNavBadge}
                  </span>
                )}
              </NavLink>
              <NavLink
                className={({ isActive }) => `ra-owner-nav__link ${isActive ? 'is-active' : ''}`}
                to="/owner/settings"
              >
                <span className="ra-owner-nav__ico" aria-hidden>
                  ⚙️
                </span>
                {t('owner.nav.settings')}
              </NavLink>
              <NavLink
                className={({ isActive }) => `ra-owner-nav__link ${isActive ? 'is-active' : ''}`}
                to="/owner/profile"
              >
                <span className="ra-owner-nav__ico" aria-hidden>
                  👤
                </span>
                {t('owner.nav.editProfile')}
              </NavLink>
            </>
          )}
        </nav>
        <button type="button" className="ra-owner-sidebar__logout" onClick={onLogout}>
          {t('nav.logout')}
        </button>
      </aside>

      <main className="ra-owner-main">
        {blocked ? (
          <>
            <div className="ra-owner-banner ra-owner-banner--blocked" role="alert">
              {t('owner.blockedLead')}
            </div>
            <Routes>
              <Route
                path="messages"
                element={<OwnerMessagesPage ownerUserId={profile.userId} ownerEmail={profile.email} />}
              />
              <Route path="*" element={<Navigate to="/owner/messages" replace />} />
            </Routes>
          </>
        ) : !subscriptionReady ? (
          <>
            <header className="ra-owner-head">
              <div>
                <h1 className="ra-owner-welcome">{t('owner.welcome', { name: firstName })}</h1>
                <p className="ra-owner-lead">{t('owner.onboarding.lead')}</p>
              </div>
            </header>
            <div className="ra-owner-banner" role="status">
              {t('owner.onboarding.registeredLine', {
                registered: formatDateDots(profile.registeredAt),
              })}
            </div>
            <h2 className="ra-owner-stats__title" style={{ marginTop: 0 }}>
              {t('owner.onboarding.plansTitle')}
            </h2>
            <p className="ra-owner-onboarding-note">{t('owner.onboarding.demoNote')}</p>
            <div className="ra-pricing-grid ra-owner-onboarding-plans">
              {pricingPlans.map((p) => (
                <article
                  key={p.id}
                  className={`ra-pricing-card ${p.popular ? 'ra-pricing-card--popular' : ''}`}
                >
                  <div className="ra-pricing-card__head">
                    <div className="ra-pricing-card__title-row">
                      <h3 className="ra-pricing-card__name">{p.name}</h3>
                      {p.popular && <span className="ra-pricing-card__badge">{t('pricing.badgePopular')}</span>}
                    </div>
                    <p className="ra-pricing-card__tagline">{p.tagline}</p>
                    <p className="ra-pricing-card__price">
                      <span className="ra-pricing-card__euro">{p.price} €</span>
                      <span className="ra-pricing-card__period">{t('pricing.perYear')}</span>
                    </p>
                  </div>
                  <ul className="ra-pricing-card__list">
                    {p.features.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="ra-btn ra-btn--primary ra-pricing-card__cta"
                    disabled={resolvePlanForSubscription(p) == null}
                    onClick={() => {
                      const target = resolvePlanForSubscription(p)
                      if (!target) return
                      activateOwnerSubscription(profile, target)
                      refreshProfile()
                    }}
                  >
                    {t('pricing.selectPlan')}
                  </button>
                </article>
              ))}
            </div>
          </>
        ) : needsBasicCategory ? (
          <>
            <header className="ra-owner-head">
              <div>
                <h1 className="ra-owner-welcome">{t('owner.welcome', { name: firstName })}</h1>
                <p className="ra-owner-lead">{t('owner.lead')}</p>
                <p className="ra-owner-plan">
                  <span className="ra-owner-plan__badge">{planLabel}</span>
                  <span className="ra-owner-plan__summary">{planSummary}</span>
                </p>
              </div>
            </header>
            <div className="ra-owner-banner" role="status">
              {t('owner.datesBanner', {
                registered: formatDateDots(profile.registeredAt),
                validUntil: formatDateDots(profile.validUntil),
              })}
            </div>
            <div className="ra-owner-basic-pick">
              <div className="ra-owner-basic-pick__callout" role="alert">
                {t('owner.basicPick.callout')}
              </div>
              <h2 className="ra-owner-basic-pick__title">{t('owner.basicPick.title')}</h2>
              <div className="ra-owner-catpick__grid">
                {CAT_ORDER.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="ra-owner-catpick__card"
                    onClick={() => {
                      saveBasicCategoryChoice(profile, c)
                      refreshProfile()
                    }}
                  >
                    <span className="ra-owner-catpick__ico" aria-hidden>
                      {c === 'accommodation' ? '🏠' : c === 'car' ? '🚗' : '🏍️'}
                    </span>
                    <span className="ra-owner-catpick__label">{t(`nav.${c}`)}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <Routes>
              <Route
                index
                element={
                  <>
                    <header className="ra-owner-head">
                      <div>
                        <h1 className="ra-owner-welcome">{t('owner.welcome', { name: firstName })}</h1>
                        <p className="ra-owner-lead">{t('owner.lead')}</p>
                        <p className="ra-owner-plan">
                          <span className="ra-owner-plan__badge">{planLabel}</span>
                          <span className="ra-owner-plan__summary">{planSummary}</span>
                        </p>
                      </div>
                      <div className="ra-owner-head__btns">
                        <button
                          type="button"
                          className="ra-btn ra-btn--primary"
                          onClick={() => setCategoryPickerOpen(true)}
                        >
                          {t('owner.newListing')}
                        </button>
                      </div>
                    </header>

                    <div className="ra-owner-banner" role="status">
              {t('owner.datesBanner', {
                registered: formatDateDots(profile.registeredAt),
                validUntil: formatDateDots(profile.validUntil),
              })}
            </div>
            {profile.promoCategoryScope && profile.promoCategoryScope.length > 0 && (
              <p className="ra-owner-banner ra-owner-banner--promo-scope" role="note">
                {t('owner.promoScopeNote', {
                  categories: profile.promoCategoryScope.map((c) => t(`nav.${c}`)).join(', '),
                })}
              </p>
            )}

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
                <table className="ra-owner-table ra-owner-table--owner-listings">
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
                          <td data-label={t('owner.colTitle')}>{row.title}</td>
                          <td data-label={t('owner.colViews')}>{row.viewsMonth}</td>
                          <td data-label={t('owner.colContacts')}>{row.contactClicksMonth}</td>
                          <td data-label={t('owner.colDates')}>
                            {row.receivedAt} / {row.expiresAt}
                          </td>
                          <td data-label={t('owner.colFeatured')}>{row.featuredUntil ?? '—'}</td>
                          <td data-label={t('owner.colNote')}>{row.internalNote ?? '—'}</td>
                          <td
                            className="ra-owner-table__actions"
                            data-label={t('owner.colActions')}
                          >
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
                              disabled={
                                row.category !== 'accommodation' &&
                                row.category !== 'car' &&
                                row.category !== 'motorcycle'
                              }
                              title={
                                row.category !== 'accommodation' &&
                                row.category !== 'car' &&
                                row.category !== 'motorcycle'
                                  ? t('owner.soon')
                                  : undefined
                              }
                              onClick={() => {
                                if (
                                  row.category !== 'accommodation' &&
                                  row.category !== 'car' &&
                                  row.category !== 'motorcycle'
                                )
                                  return
                                setListingModalCategory(
                                  row.category === 'car'
                                    ? 'car'
                                    : row.category === 'motorcycle'
                                      ? 'motorcycle'
                                      : 'accommodation',
                                )
                                setAcmodalEditingRowId(row.id)
                                setAccommodationModalOpen(true)
                              }}
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
                  </>
                }
              />
              <Route path="inquiries" element={<OwnerInquiriesPage ownerUserId={profile.userId} />} />
              <Route
                path="messages"
                element={<OwnerMessagesPage ownerUserId={profile.userId} ownerEmail={profile.email} />}
              />
              <Route path="ads" element={<OwnerAdsPage profile={profile} />} />
              <Route path="forum" element={<OwnerForumPage profile={profile} />} />
              <Route path="code" element={<OwnerCodePage profile={profile} refreshProfile={refreshProfile} />} />
              <Route
                path="settings"
                element={<OwnerSettingsPage profile={profile} refreshProfile={refreshProfile} />}
              />
              <Route
                path="profile"
                element={<OwnerEditProfilePage profile={profile} refreshProfile={refreshProfile} />}
              />
            </Routes>
          </>
        )}

        <p className="ra-owner-privacy">{t('owner.privacyNote')}</p>
      </main>
      </div>

      <Footer />

      <CategoryPickerModal
        open={
          categoryPickerOpen &&
          !blocked &&
          subscriptionReady &&
          !needsBasicCategory &&
          profile.plan != null
        }
        onClose={() => setCategoryPickerOpen(false)}
        unlocked={unlocked}
        onPick={(c) => {
          setListingModalCategory(
            c === 'car' ? 'car' : c === 'motorcycle' ? 'motorcycle' : 'accommodation',
          )
          setAcmodalEditingRowId(null)
          setAccommodationModalOpen(true)
        }}
      />

      {profile &&
        accommodationModalOpen &&
        !blocked &&
        subscriptionReady &&
        !needsBasicCategory &&
        profile.plan != null && (
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
            formCategory={listingModalCategory}
            onClose={() => {
              setAccommodationModalOpen(false)
              setAcmodalEditingRowId(null)
            }}
            profile={profile}
            onSaved={reload}
            editingOwnerRowId={acmodalEditingRowId}
          />
        </Suspense>
      )}
    </div>
  )
}
