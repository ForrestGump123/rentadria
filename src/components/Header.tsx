import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { ListingCategory } from '../types'
import type { SubscriptionPlan } from '../types/plan'
import type { CurrencyCode } from '../types/currency'
import { useCurrency } from '../context/CurrencyContext'
import { LANGUAGES, type LanguageCode } from '../languages'
import { AuthModal } from './AuthModal'
import { Logo } from './Logo'
import { fetchAdminLogout } from '../lib/adminAuthApi'
import { isAdminSession, setAdminSession } from '../utils/adminSession'
import { TreatBeerLink } from './TreatBeerLink'
import { clearOwnerSession } from '../utils/ownerSession'
import { isLoggedIn } from '../utils/storage'

type HeaderProps = {
  category: ListingCategory
  onCategory: (c: ListingCategory) => void
  /** From /?register=1 after choosing a plan on pricing */
  registrationIntent?: { plan: SubscriptionPlan | null } | null
  onConsumedRegistrationIntent?: () => void
}

const icons = {
  accommodation: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z"
      />
    </svg>
  ),
  car: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"
      />
    </svg>
  ),
  motorcycle: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M17.4 4.5c-.4 0-.8.2-1 .6l-1.4 2.4H9.5L8.3 6.2c-.2-.3-.5-.5-.9-.5H5v2h1.6l.6 1.1-2.3 4.1C4.1 14 3.5 15 3.5 16c0 1.9 1.6 3.5 3.5 3.5S10.5 17.9 10.5 16c0-.4-.1-.8-.2-1.2l1.1-2h3.1l.5 1.8c.3 1.1 1.3 1.9 2.5 1.9 1.4 0 2.5-1.1 2.5-2.5 0-.3 0-.6-.1-.9l-1.8-6.4 1.2-2.1c.1-.2.2-.4.2-.6 0-.6-.4-1-1-1h-1.6zm-8.9 9.5c-.8 0-1.5-.7-1.5-1.5S7.7 11 8.5 11s1.5.7 1.5 1.5S9.3 14 8.5 14zm7.5 3c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1z"
      />
    </svg>
  ),
}

const cats: { id: ListingCategory; icon: (typeof icons)[keyof typeof icons] }[] = [
  { id: 'accommodation', icon: icons.accommodation },
  { id: 'car', icon: icons.car },
  { id: 'motorcycle', icon: icons.motorcycle },
]

const CURRENCIES: CurrencyCode[] = ['EUR', 'BAM', 'ALL']

/** Short symbols on the toggle; ISO codes stay visible beside them */
const CURRENCY_SYM: Record<CurrencyCode, string> = {
  EUR: '€',
  BAM: 'KM',
  ALL: 'Lek',
}

export function Header({
  category,
  onCategory,
  registrationIntent,
  onConsumedRegistrationIntent,
}: HeaderProps) {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { currency, setCurrency } = useCurrency()
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [modalPlan, setModalPlan] = useState<SubscriptionPlan | null>(null)
  const [langOpen, setLangOpen] = useState(false)
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [logged, setLogged] = useState(() => isLoggedIn())
  const [adminLogged, setAdminLogged] = useState(() => isAdminSession())
  const location = useLocation()
  const moreWrapRef = useRef<HTMLDivElement>(null)
  const currentLang =
    (LANGUAGES.find((l) => l.code === (i18n.language || 'en').split('-')[0])?.code ?? 'en') as LanguageCode
  const current = LANGUAGES.find((l) => l.code === currentLang) ?? LANGUAGES[0]

  useEffect(() => {
    if (!registrationIntent) return
    const tid = setTimeout(() => {
      setModalPlan(registrationIntent.plan)
      setAuthMode('register')
      setAuthOpen(true)
      onConsumedRegistrationIntent?.()
    }, 0)
    return () => clearTimeout(tid)
  }, [registrationIntent, onConsumedRegistrationIntent])

  useEffect(() => {
    if (!langOpen && !currencyOpen) return
    const onDoc = () => {
      setLangOpen(false)
      setCurrencyOpen(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [langOpen, currencyOpen])

  useEffect(() => {
    if (!moreMenuOpen) return
    const onDoc = (e: MouseEvent) => {
      const n = e.target as Node
      if (moreWrapRef.current?.contains(n)) return
      setMoreMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [moreMenuOpen])

  useEffect(() => {
    const onAuth = () => setLogged(isLoggedIn())
    window.addEventListener('rentadria-auth', onAuth)
    return () => window.removeEventListener('rentadria-auth', onAuth)
  }, [])

  useEffect(() => {
    const onAdmin = () => setAdminLogged(isAdminSession())
    window.addEventListener('rentadria-admin-auth', onAdmin)
    return () => window.removeEventListener('rentadria-admin-auth', onAdmin)
  }, [])

  useEffect(() => {
    const tid = setTimeout(() => setMoreMenuOpen(false), 0)
    return () => clearTimeout(tid)
  }, [location.pathname, location.search])

  const closeAuth = () => {
    setAuthOpen(false)
    setModalPlan(null)
  }

  const openLogin = () => {
    setModalPlan(null)
    setAuthMode('login')
    setAuthOpen(true)
    setMoreMenuOpen(false)
  }

  const openRegister = () => {
    setModalPlan(null)
    setAuthMode('register')
    setAuthOpen(true)
    setMoreMenuOpen(false)
  }

  return (
    <>
      <header
        className={`ra-header ${moreMenuOpen ? 'ra-header--menus-open' : ''}`}
      >
        <div className="ra-header__inner">
          <Logo variant="header" />

          <div className="ra-header__mobile-tools">
            <div className="ra-header__more-wrap" ref={moreWrapRef}>
              <button
                type="button"
                id="ra-header-more-trigger"
                className={`ra-header__more-trigger ${moreMenuOpen ? 'ra-header__more-trigger--open' : ''}`}
                aria-expanded={moreMenuOpen}
                aria-controls="ra-header-more-panel"
                aria-haspopup="menu"
                aria-label={t('nav.siteMenuAria')}
                onClick={(e) => {
                  e.stopPropagation()
                  setLangOpen(false)
                  setCurrencyOpen(false)
                  setMoreMenuOpen((o) => !o)
                }}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
                  />
                </svg>
              </button>
              {moreMenuOpen ? (
                <div
                  id="ra-header-more-panel"
                  className="ra-header__more-panel"
                  role="menu"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <div className="ra-header__more-section">
                    <p className="ra-header__more-h">{t('nav.moreSectionAccount')}</p>
                    <div className="ra-header__more-actions">
                      {adminLogged && (
                        <>
                          <Link to="/admin" className="ra-link-btn" onClick={() => setMoreMenuOpen(false)}>
                            {t('nav.adminPanel')}
                          </Link>
                          <button
                            type="button"
                            className="ra-link-btn"
                            onClick={() => {
                              void (async () => {
                                await fetchAdminLogout()
                                setAdminSession(false)
                                setAdminLogged(false)
                                setMoreMenuOpen(false)
                                navigate('/', { replace: true })
                              })()
                            }}
                          >
                            {t('nav.adminLogout')}
                          </button>
                        </>
                      )}
                      {logged && (
                        <>
                          <Link to="/owner" className="ra-link-btn" onClick={() => setMoreMenuOpen(false)}>
                            {t('nav.ownerDashboard')}
                          </Link>
                          <button
                            type="button"
                            className="ra-link-btn"
                            onClick={() => {
                              clearOwnerSession()
                              setLogged(false)
                              setMoreMenuOpen(false)
                              navigate('/', { replace: true })
                            }}
                          >
                            {t('nav.logout')}
                          </button>
                        </>
                      )}
                      {!adminLogged && !logged && (
                        <>
                          <button type="button" className="ra-btn ra-btn--primary" onClick={openLogin}>
                            {t('nav.login')}
                          </button>
                          <button type="button" className="ra-btn ra-btn--primary" onClick={openRegister}>
                            {t('nav.register')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="ra-header__more-section">
                    <p className="ra-header__more-h">{t('nav.moreSectionLanguage')}</p>
                    <div className="ra-header__more-lang-grid">
                      {LANGUAGES.map((l) => (
                        <button
                          key={l.code}
                          type="button"
                          className={`ra-header__chip ${l.code === currentLang ? 'is-active' : ''}`}
                          onClick={() => {
                            void i18n.changeLanguage(l.code as LanguageCode)
                            setMoreMenuOpen(false)
                          }}
                        >
                          <span aria-hidden>{l.flag}</span>
                          <span>{l.short}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="ra-header__more-section">
                    <p className="ra-header__more-h">{t('nav.moreSectionCurrency')}</p>
                    <div className="ra-header__more-currency-grid">
                      {CURRENCIES.map((code) => (
                        <button
                          key={code}
                          type="button"
                          className={`ra-header__chip ${code === currency ? 'is-active' : ''}`}
                          onClick={() => {
                            setCurrency(code)
                            setMoreMenuOpen(false)
                          }}
                        >
                          <span>{CURRENCY_SYM[code]}</span>
                          <span>{code}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="ra-header__more-section">
                    <TreatBeerLink variant="header" />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <nav
            className="ra-nav ra-nav--desktop"
            aria-label={t('nav.categoriesAria')}
          >
            {cats.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`ra-nav__btn ${category === c.id ? 'ra-nav__btn--active' : ''}`}
                onClick={() => onCategory(c.id)}
              >
                <span className="ra-nav__icon">{c.icon}</span>
                <span>{t(`nav.${c.id}`)}</span>
              </button>
            ))}
          </nav>

          <div className="ra-header__actions ra-header__actions--desktop">
            <TreatBeerLink variant="header" />
            {adminLogged && (
              <>
                <Link to="/admin" className="ra-link-btn">
                  {t('nav.adminPanel')}
                </Link>
                <button
                  type="button"
                  className="ra-link-btn"
                  onClick={() => {
                    void (async () => {
                      await fetchAdminLogout()
                      setAdminSession(false)
                      setAdminLogged(false)
                      navigate('/', { replace: true })
                    })()
                  }}
                >
                  {t('nav.adminLogout')}
                </button>
              </>
            )}
            {logged && (
              <>
                <Link to="/owner" className="ra-link-btn">
                  {t('nav.ownerDashboard')}
                </Link>
                <button
                  type="button"
                  className="ra-link-btn"
                  onClick={() => {
                    clearOwnerSession()
                    setLogged(false)
                    navigate('/', { replace: true })
                  }}
                >
                  {t('nav.logout')}
                </button>
              </>
            )}
            {!adminLogged && !logged && (
              <>
                <button
                  type="button"
                  className="ra-btn ra-btn--primary"
                  onClick={() => {
                    setModalPlan(null)
                    setAuthMode('login')
                    setAuthOpen(true)
                  }}
                >
                  {t('nav.login')}
                </button>
                <button
                  type="button"
                  className="ra-btn ra-btn--primary"
                  onClick={() => {
                    setModalPlan(null)
                    setAuthMode('register')
                    setAuthOpen(true)
                  }}
                >
                  {t('nav.register')}
                </button>
              </>
            )}

            <div className="ra-header__locale">
              <div
                className={`ra-lang ${langOpen ? 'ra-lang--open' : ''}`}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="ra-lang__toggle"
                  aria-expanded={langOpen}
                  aria-haspopup="listbox"
                  onClick={(e) => {
                    e.stopPropagation()
                    setCurrencyOpen(false)
                    setLangOpen(!langOpen)
                  }}
                >
                  <span className="ra-lang__flag" aria-hidden>
                    {current.flag}
                  </span>
                  <span>{current.short}</span>
                  <span className="ra-lang__chev" aria-hidden>
                    ▾
                  </span>
                </button>
                {langOpen && (
                  <ul className="ra-lang__menu" role="listbox">
                    {LANGUAGES.map((l) => (
                      <li key={l.code}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={l.code === currentLang}
                          className={l.code === currentLang ? 'is-active' : ''}
                          onClick={() => {
                            void i18n.changeLanguage(l.code as LanguageCode)
                            setLangOpen(false)
                          }}
                        >
                          <span aria-hidden>{l.flag}</span>
                          <span>{l.short}</span>
                          <span className="ra-lang__name">{l.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div
                className={`ra-currency ${currencyOpen ? 'ra-currency--open' : ''}`}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="ra-currency__toggle"
                  aria-expanded={currencyOpen}
                  aria-haspopup="listbox"
                  aria-label={`${t('currency.aria')}: ${t(`currency.${currency.toLowerCase()}`)}`}
                  title={t(`currency.${currency.toLowerCase()}`)}
                  onClick={(e) => {
                    e.stopPropagation()
                    setLangOpen(false)
                    setCurrencyOpen(!currencyOpen)
                  }}
                >
                  <span className="ra-currency__sym" aria-hidden>
                    {CURRENCY_SYM[currency]}
                  </span>
                  <span className="ra-currency__iso">{currency}</span>
                  <span className="ra-lang__chev" aria-hidden>
                    ▾
                  </span>
                </button>
                {currencyOpen && (
                  <ul className="ra-currency__menu" role="listbox">
                    {CURRENCIES.map((code) => (
                      <li key={code}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={code === currency}
                          className={code === currency ? 'is-active' : ''}
                          onClick={() => {
                            setCurrency(code)
                            setCurrencyOpen(false)
                          }}
                        >
                          <span className="ra-currency__label">{t(`currency.${code.toLowerCase()}`)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        <nav className="ra-header__mobile-catbar" aria-label={t('nav.categoriesAria')}>
          <div className="ra-header__mobile-catbar-inner">
            {cats.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`ra-header__mobile-catbtn ${category === c.id ? 'is-active' : ''}`}
                aria-current={category === c.id ? 'page' : undefined}
                onClick={() => {
                  setMoreMenuOpen(false)
                  onCategory(c.id)
                }}
              >
                <span className="ra-header__mobile-catbtn-icon" aria-hidden>
                  {c.icon}
                </span>
                <span className="ra-header__mobile-catbtn-label">{t(`nav.${c.id}`)}</span>
              </button>
            ))}
          </div>
        </nav>
      </header>
      <AuthModal
        open={authOpen}
        mode={authMode}
        onClose={closeAuth}
        onSwitchMode={setAuthMode}
        initialPlan={modalPlan}
      />
    </>
  )
}
