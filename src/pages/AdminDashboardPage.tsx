import { type FormEvent, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'
import type { ListingCategory } from '../types'
import { isAdminSession, setAdminSession, verifyAdminPassword } from '../utils/adminSession'
import {
  countListings,
  countOwnerAccounts,
  countReportRows,
  countReviewBuckets,
} from '../utils/adminStats'

type NavItem = {
  id: string
  labelKey: string
  disabled?: boolean
  to?: string
}

const NAV: NavItem[] = [
  { id: 'overview', labelKey: 'admin.nav.overview', to: '/admin' },
  { id: 'visits', labelKey: 'admin.nav.visits', disabled: true },
  { id: 'listings', labelKey: 'admin.nav.listings', disabled: true },
  { id: 'owners', labelKey: 'admin.nav.owners', disabled: true },
  { id: 'inquiries', labelKey: 'admin.nav.inquiries', disabled: true },
  { id: 'reports', labelKey: 'admin.nav.reports', disabled: true },
  { id: 'reviews', labelKey: 'admin.nav.reviews', disabled: true },
  { id: 'users', labelKey: 'admin.nav.users', disabled: true },
  { id: 'images', labelKey: 'admin.nav.images', disabled: true },
  { id: 'staff', labelKey: 'admin.nav.staff', disabled: true },
  { id: 'ownerMessages', labelKey: 'admin.nav.ownerMessages', disabled: true },
  { id: 'promo', labelKey: 'admin.nav.promo', disabled: true },
  { id: 'expiring', labelKey: 'admin.nav.expiring', disabled: true },
  { id: 'paused', labelKey: 'admin.nav.paused', disabled: true },
  { id: 'banners', labelKey: 'admin.nav.banners', disabled: true },
  { id: 'pricing', labelKey: 'admin.nav.pricing', to: '/pricing' },
  { id: 'terms', labelKey: 'admin.nav.terms', to: '/terms' },
  { id: 'privacy', labelKey: 'admin.nav.privacy', to: '/privacy' },
  { id: 'faq', labelKey: 'admin.nav.faq', to: '/faq' },
  { id: 'import', labelKey: 'admin.nav.import', disabled: true },
]

export function AdminDashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [authed, setAuthed] = useState(() => isAdminSession())
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  const stats = useMemo(
    () => ({
      listings: countListings(),
      reviews: countReviewBuckets(),
      owners: countOwnerAccounts(),
      reports: countReportRows(),
    }),
    [authed],
  )

  const login = (e: FormEvent) => {
    e.preventDefault()
    if (verifyAdminPassword(password)) {
      setAdminSession(true)
      setAuthed(true)
      setError(false)
      setPassword('')
    } else {
      setError(true)
    }
  }

  const logoutAdmin = () => {
    setAdminSession(false)
    setAuthed(false)
    navigate('/', { replace: true })
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
              if (item.to && !item.disabled) {
                if (item.id === 'overview') {
                  return (
                    <NavLink
                      key={item.id}
                      end
                      to={item.to}
                      className={({ isActive }) =>
                        `ra-admin-nav__link ${isActive ? 'is-active' : ''}`
                      }
                    >
                      <span className="ra-admin-nav__ico" aria-hidden>
                        📊
                      </span>
                      {label}
                    </NavLink>
                  )
                }
                return (
                  <Link key={item.id} to={item.to} className="ra-admin-nav__link ra-admin-nav__link--sub">
                    {label}
                  </Link>
                )
              }
              return (
                <span
                  key={item.id}
                  className="ra-admin-nav__link ra-admin-nav__link--disabled"
                  title={t('owner.soon')}
                >
                  <span className="ra-admin-nav__ico" aria-hidden>
                    ·
                  </span>
                  {label}
                </span>
              )
            })}
          </nav>
          <button type="button" className="ra-admin-sidebar__logout" onClick={logoutAdmin}>
            {t('admin.logout')}
          </button>
        </aside>

        <main className="ra-admin-main">
          <header className="ra-admin-head">
            <h1 className="ra-admin-title">{t('admin.pageTitle')}</h1>
            <p className="ra-admin-subtitle">{t('admin.subtitle')}</p>
          </header>

          <div className="ra-admin-cards">
            <div className="ra-admin-card ra-admin-card--listings">
              <span className="ra-admin-card__ico" aria-hidden>
                📄
              </span>
              <strong>{stats.listings}</strong>
              <span>{t('admin.cardListings')}</span>
            </div>
            <div className="ra-admin-card ra-admin-card--reviews">
              <span className="ra-admin-card__ico" aria-hidden>
                ⭐
              </span>
              <strong>{stats.reviews}</strong>
              <span>{t('admin.cardReviews')}</span>
            </div>
            <div className="ra-admin-card ra-admin-card--owners">
              <span className="ra-admin-card__ico" aria-hidden>
                👤
              </span>
              <strong>{stats.owners}</strong>
              <span>{t('admin.cardOwners')}</span>
            </div>
            <div className="ra-admin-card ra-admin-card--reports">
              <span className="ra-admin-card__ico" aria-hidden>
                ⚠️
              </span>
              <strong>{stats.reports}</strong>
              <span>{t('admin.cardReports')}</span>
            </div>
          </div>

          <section className="ra-admin-activity" aria-labelledby="admin-activity-h">
            <h2 id="admin-activity-h" className="ra-admin-activity__title">
              {t('admin.recentTitle')}
            </h2>
            <p className="ra-admin-activity__empty">{t('admin.recentEmpty')}</p>
          </section>
        </main>
      </div>

      <Footer />
    </div>
  )
}
