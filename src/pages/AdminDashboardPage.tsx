import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import type { ListingCategory } from '../types'
import { fetchAdminLogin, fetchAdminLogout } from '../lib/adminAuthApi'
import { isAdminSession, setAdminSession } from '../utils/adminSession'
import { fetchAdminDashboardStats } from '../lib/fetchAdminStats'
import {
  countCatalogListings,
  countOwnerAccounts,
  countOwnerListingRows,
  countReportRows,
  countReviewBuckets,
} from '../utils/adminStats'
import { getUnreadThreadCountForAdmin, pullThreadsForAdmin } from '../utils/ownerAdminMessages'
import { getAdminReviewUnreadCount } from '../utils/reviewStorage'
import { getAdminReportsUnreadCount } from '../utils/storage'
import { getAdminVisitorInquiryUnreadCount } from '../utils/visitorInquiries'
import { AdminBannersPage } from './admin/AdminBannersPage'
import { AdminDeletedOwnersPage } from './admin/AdminDeletedOwnersPage'
import { AdminEngagementPage } from './admin/AdminEngagementPage'
import { AdminExpiringPage } from './admin/AdminExpiringPage'
import { AdminImagesPage } from './admin/AdminImagesPage'
import { AdminImportPage } from './admin/AdminImportPage'
import { AdminInquiriesPage } from './admin/AdminInquiriesPage'
import { AdminLegalEditorPage } from './admin/AdminLegalEditorPage'
import { AdminListingsPage } from './admin/AdminListingsPage'
import { AdminOwnersPage } from './admin/AdminOwnersPage'
import { AdminOwnerMessagesPage } from './admin/AdminOwnerMessagesPage'
import { AdminPausedPage } from './admin/AdminPausedPage'
import { AdminPlaceholderPage } from './admin/AdminPlaceholderPage'
import { AdminPricingPage } from './admin/AdminPricingPage'
import { AdminPromoPage } from './admin/AdminPromoPage'
import { AdminReportsPage } from './admin/AdminReportsPage'
import { AdminReviewsPage } from './admin/AdminReviewsPage'
import { AdminStaffPage } from './admin/AdminStaffPage'
import { AdminVisitsPage } from './admin/AdminVisitsPage'

type NavItem = {
  id: string
  labelKey: string
  to: string
}

const NAV: NavItem[] = [
  { id: 'overview', labelKey: 'admin.nav.overview', to: '/admin' },
  { id: 'visits', labelKey: 'admin.nav.visits', to: '/admin/visits' },
  { id: 'engagement', labelKey: 'admin.nav.engagement', to: '/admin/engagement' },
  { id: 'listings', labelKey: 'admin.nav.listings', to: '/admin/listings' },
  { id: 'owners', labelKey: 'admin.nav.owners', to: '/admin/owners' },
  { id: 'deletedOwners', labelKey: 'admin.nav.deletedOwners', to: '/admin/deleted-owners' },
  { id: 'inquiries', labelKey: 'admin.nav.inquiries', to: '/admin/inquiries' },
  { id: 'reports', labelKey: 'admin.nav.reports', to: '/admin/reports' },
  { id: 'reviews', labelKey: 'admin.nav.reviews', to: '/admin/reviews' },
  { id: 'users', labelKey: 'admin.nav.users', to: '/admin/users' },
  { id: 'images', labelKey: 'admin.nav.images', to: '/admin/images' },
  { id: 'staff', labelKey: 'admin.nav.staff', to: '/admin/staff' },
  { id: 'ownerMessages', labelKey: 'admin.nav.ownerMessages', to: '/admin/messages' },
  { id: 'promo', labelKey: 'admin.nav.promo', to: '/admin/promo' },
  { id: 'expiring', labelKey: 'admin.nav.expiring', to: '/admin/expiring' },
  { id: 'paused', labelKey: 'admin.nav.paused', to: '/admin/paused' },
  { id: 'banners', labelKey: 'admin.nav.banners', to: '/admin/banners' },
  { id: 'pricing', labelKey: 'admin.nav.pricing', to: '/admin/pricing' },
  { id: 'terms', labelKey: 'admin.nav.terms', to: '/admin/legal/terms' },
  { id: 'privacy', labelKey: 'admin.nav.privacy', to: '/admin/legal/privacy' },
  { id: 'faq', labelKey: 'admin.nav.faq', to: '/admin/legal/faq' },
  { id: 'import', labelKey: 'admin.nav.import', to: '/admin/import' },
]

const NAV_ICONS: Record<string, string> = {
  overview: '📊',
  visits: '🇲🇪',
  engagement: '📈',
  listings: '📋',
  owners: '👥',
  deletedOwners: '🗑️',
  inquiries: '💬',
  reports: '⚠️',
  reviews: '⭐',
  users: '🧑',
  images: '🖼️',
  staff: '👔',
  ownerMessages: '✉️',
  promo: '🏷️',
  expiring: '⏳',
  paused: '⏸️',
  banners: '🎯',
  pricing: '💶',
  terms: '📜',
  privacy: '🔒',
  faq: '❓',
  import: '📥',
}

const ADMIN_PLACEHOLDER_IDS = ['users'] as const

export function AdminDashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [authed, setAuthed] = useState(() => isAdminSession())
  const [adminEmail, setAdminEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [badgeInquiries, setBadgeInquiries] = useState(0)
  const [badgeReports, setBadgeReports] = useState(0)
  const [badgeReviews, setBadgeReviews] = useState(0)
  const [badgeMessages, setBadgeMessages] = useState(0)
  const [serverDash, setServerDash] = useState<{
    owners: number | null
    listings: number | null
    reviews: number | null
    reports: number | null
  } | null>(null)

  useEffect(() => {
    if (!authed) {
      const tid = setTimeout(() => setServerDash(null), 0)
      return () => clearTimeout(tid)
    }
    let cancelled = false
    void (async () => {
      const j = await fetchAdminDashboardStats()
      if (cancelled) return
      if (!j) {
        setServerDash(null)
        return
      }
      setServerDash({
        owners: typeof j.ownersRegistered === 'number' ? j.ownersRegistered : null,
        listings: typeof j.ownerListings === 'number' ? j.ownerListings : null,
        reviews: typeof j.reviewBuckets === 'number' ? j.reviewBuckets : null,
        reports: typeof j.reportsSubmitted === 'number' ? j.reportsSubmitted : null,
      })
    })()
    return () => {
      cancelled = true
    }
  }, [authed])

  useEffect(() => {
    const sync = () => {
      setBadgeInquiries(getAdminVisitorInquiryUnreadCount())
      setBadgeReports(getAdminReportsUnreadCount())
      setBadgeReviews(getAdminReviewUnreadCount())
      setBadgeMessages(getUnreadThreadCountForAdmin())
    }
    sync()
    const names = [
      'rentadria-admin-visitor-inquiries-updated',
      'rentadria-admin-reports-unread-changed',
      'rentadria-admin-reviews-unread-changed',
      'rentadria-admin-messages-unread-changed',
    ] as const
    names.forEach((n) => window.addEventListener(n, sync))
    return () => names.forEach((n) => window.removeEventListener(n, sync))
  }, [authed])

  useEffect(() => {
    if (!authed) return
    let stopped = false
    const pull = () => {
      void pullThreadsForAdmin().then(() => {
        if (!stopped) setBadgeMessages(getUnreadThreadCountForAdmin())
      })
    }
    pull()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') pull()
    }, 30_000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [authed])

  const navBadgeCount = (navId: string) => {
    if (navId === 'inquiries') return badgeInquiries
    if (navId === 'reports') return badgeReports
    if (navId === 'reviews') return badgeReviews
    if (navId === 'ownerMessages') return badgeMessages
    return 0
  }

  const stats = useMemo(
    () => ({
      ownerListingRows: serverDash?.listings ?? countOwnerListingRows(),
      catalogListings: countCatalogListings(),
      reviews: serverDash?.reviews ?? countReviewBuckets(),
      owners: serverDash?.owners ?? countOwnerAccounts(),
      reports: serverDash?.reports ?? countReportRows(),
    }),
    [serverDash],
  )

  const serverBacked = (k: 'owners' | 'listings' | 'reviews' | 'reports') =>
    serverDash != null && typeof serverDash[k] === 'number'

  const login = async (e: FormEvent) => {
    e.preventDefault()
    const ok = await fetchAdminLogin(adminEmail, password)
    if (ok) {
      setAdminSession(true)
      setAuthed(true)
      setError(false)
      setPassword('')
      setAdminEmail('')
    } else {
      setError(true)
    }
  }

  const logoutAdmin = () => {
    void (async () => {
      await fetchAdminLogout()
      setAdminSession(false)
      setAuthed(false)
      navigate('/', { replace: true })
    })()
  }

  if (!authed) {
    return (
      <div className="ra-app ra-owner-with-chrome">
        <Helmet>
          <title>{t('admin.loginTitle')} · RentAdria</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <Header category="accommodation" onCategory={(c: ListingCategory) => navigate(`/?cat=${c}`)} />
        <main className="ra-admin-gate">
          <form className="ra-admin-gate__panel" onSubmit={login}>
            <h1 className="ra-admin-gate__h">{t('admin.loginTitle')}</h1>
            <p className="ra-admin-gate__hint">{t('admin.loginHint')}</p>
            <label className="ra-fld">
              <span>{t('admin.emailLabel')}</span>
              <input
                type="email"
                autoComplete="username"
                value={adminEmail}
                onChange={(e) => {
                  setAdminEmail(e.target.value)
                  setError(false)
                }}
                className={error ? 'ra-admin-gate__input--err' : ''}
              />
            </label>
            <label className="ra-fld">
              <span>{t('admin.passwordLabel')}</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(false)
                }}
                className={error ? 'ra-admin-gate__input--err' : ''}
              />
            </label>
            {error && <p className="ra-admin-gate__err">{t('admin.loginError')}</p>}
            <button type="submit" className="ra-btn ra-btn--primary ra-btn--block">
              {t('admin.loginSubmit')}
            </button>
            <p className="ra-admin-gate__back">
              <Link to="/">{t('admin.backHome')}</Link>
            </p>
          </form>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="ra-app ra-owner-with-chrome">
      <Helmet>
        <title>{t('admin.pageTitle')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <Header category="accommodation" onCategory={(c: ListingCategory) => navigate(`/?cat=${c}`)} />

      <div className="ra-admin-shell">
        <aside className="ra-admin-sidebar" aria-label={t('admin.sidebarAria')}>
          <nav className="ra-admin-nav">
            {NAV.map((item) => {
              const label = t(item.labelKey)
              const icon = NAV_ICONS[item.id] ?? '·'
              const to = item.to

              if (!to.startsWith('/admin')) {
                return (
                  <Link key={item.id} to={to} className="ra-admin-nav__link ra-admin-nav__link--sub">
                    {label}
                  </Link>
                )
              }

              const nb = navBadgeCount(item.id)

              if (item.id === 'overview') {
                return (
                  <NavLink
                    key={item.id}
                    end
                    to={to}
                    className={({ isActive }) =>
                      `ra-admin-nav__link ${isActive ? 'is-active' : ''}`
                    }
                  >
                    <span className="ra-admin-nav__ico" aria-hidden>
                      {icon}
                    </span>
                    {label}
                    {nb > 0 && (
                      <span className="ra-admin-nav__badge" aria-label={String(nb)}>
                        {nb > 99 ? '99+' : nb}
                      </span>
                    )}
                  </NavLink>
                )
              }

              return (
                <NavLink
                  key={item.id}
                  to={to}
                  className={({ isActive }) =>
                    `ra-admin-nav__link ${isActive ? 'is-active' : ''}`
                  }
                >
                  <span className="ra-admin-nav__ico" aria-hidden>
                    {icon}
                  </span>
                  {label}
                  {nb > 0 && (
                    <span className="ra-admin-nav__badge" aria-label={String(nb)}>
                      {nb > 99 ? '99+' : nb}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </nav>
          <button type="button" className="ra-admin-sidebar__logout" onClick={logoutAdmin}>
            {t('admin.logout')}
          </button>
        </aside>

        <main className="ra-admin-main">
          <Routes>
            <Route
              index
              element={
                <>
                  <header className="ra-admin-head">
                    <h1 className="ra-admin-title">{t('admin.pageTitle')}</h1>
                    <p className="ra-admin-subtitle">{t('admin.subtitle')}</p>
                    <p className="ra-admin-subtitle ra-admin-subtitle--muted">{t('admin.statsNote')}</p>
                  </header>

                  <div className="ra-admin-cards">
                    <div className="ra-admin-card ra-admin-card--listings">
                      <span className="ra-admin-card__ico" aria-hidden>
                        📄
                      </span>
                      <strong>{stats.ownerListingRows}</strong>
                      <span className="ra-admin-card__label">{t('admin.cardListings')}</span>
                      <span className="ra-admin-card__hint">
                        {serverBacked('listings')
                          ? t('admin.cardHintServer')
                          : t('admin.cardListingsHint', { n: stats.catalogListings })}
                      </span>
                    </div>
                    <div className="ra-admin-card ra-admin-card--reviews">
                      <span className="ra-admin-card__ico" aria-hidden>
                        ⭐
                      </span>
                      <strong>{stats.reviews}</strong>
                      <span className="ra-admin-card__label">{t('admin.cardReviews')}</span>
                      <span className="ra-admin-card__hint">
                        {serverBacked('reviews') ? t('admin.cardHintServer') : t('admin.cardReviewsHint')}
                      </span>
                    </div>
                    <div className="ra-admin-card ra-admin-card--owners">
                      <span className="ra-admin-card__ico" aria-hidden>
                        👤
                      </span>
                      <strong>{stats.owners}</strong>
                      <span className="ra-admin-card__label">{t('admin.cardOwners')}</span>
                      <span className="ra-admin-card__hint">
                        {serverBacked('owners') ? t('admin.cardOwnersHintServer') : t('admin.cardOwnersHintLocal')}
                      </span>
                    </div>
                    <div className="ra-admin-card ra-admin-card--reports">
                      <span className="ra-admin-card__ico" aria-hidden>
                        ⚠️
                      </span>
                      <strong>{stats.reports}</strong>
                      <span className="ra-admin-card__label">{t('admin.cardReports')}</span>
                      <span className="ra-admin-card__hint">
                        {serverBacked('reports') ? t('admin.cardHintServer') : t('admin.cardReportsHint')}
                      </span>
                    </div>
                  </div>

                  <section className="ra-admin-activity" aria-labelledby="admin-activity-h">
                    <h2 id="admin-activity-h" className="ra-admin-activity__title">
                      {t('admin.recentTitle')}
                    </h2>
                    <p className="ra-admin-activity__empty">{t('admin.recentEmpty')}</p>
                  </section>
                </>
              }
            />
            <Route path="visits" element={<AdminVisitsPage />} />
            <Route path="engagement" element={<AdminEngagementPage />} />
            <Route path="listings" element={<AdminListingsPage />} />
            <Route path="owners" element={<AdminOwnersPage />} />
            <Route path="deleted-owners" element={<AdminDeletedOwnersPage />} />
            <Route path="import" element={<AdminImportPage />} />
            <Route path="messages" element={<AdminOwnerMessagesPage />} />
            <Route path="inquiries" element={<AdminInquiriesPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="reviews" element={<AdminReviewsPage />} />
            <Route path="images" element={<AdminImagesPage />} />
            <Route path="staff" element={<AdminStaffPage />} />
            <Route path="promo" element={<AdminPromoPage />} />
            <Route path="expiring" element={<AdminExpiringPage />} />
            <Route path="paused" element={<AdminPausedPage />} />
            <Route path="banners" element={<AdminBannersPage />} />
            <Route path="pricing" element={<AdminPricingPage />} />
            <Route path="legal/:page" element={<AdminLegalEditorPage />} />
            {ADMIN_PLACEHOLDER_IDS.map((id) => (
              <Route
                key={id}
                path={id}
                element={<AdminPlaceholderPage titleKey={`admin.nav.${id}`} />}
              />
            ))}
          </Routes>
        </main>
      </div>

      <Footer />
    </div>
  )
}
