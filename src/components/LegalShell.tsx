import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Footer } from './Footer'
import { Logo } from './Logo'

type LegalShellProps = {
  title: string
  children: ReactNode
  /** @default true */
  showLastUpdated?: boolean
  /** Wider main column (e.g. pricing grid) */
  wide?: boolean
}

export function LegalShell({ title, children, showLastUpdated = true, wide = false }: LegalShellProps) {
  const { t, i18n } = useTranslation()
  const [searchParams] = useSearchParams()
  const fromRegister = searchParams.get('from') === 'register'

  useEffect(() => {
    document.documentElement.lang = i18n.language.split('-')[0]
  }, [i18n.language])

  return (
    <div className="ra-app">
      <Helmet>
        <title>{title} · RentAdria</title>
        <meta name="robots" content="index,follow" />
      </Helmet>
      <header className="ra-legal-top">
        <Logo variant="header" />
        <div className="ra-legal-top__actions">
          <Link to="/" className="ra-btn ra-btn--ghost">
            {t('legal.backHome')}
          </Link>
          {fromRegister && (
            <Link to="/?register=1" className="ra-btn ra-btn--ghost">
              {t('legal.backRegister')}
            </Link>
          )}
        </div>
      </header>
      <main className={`ra-legal-main ${wide ? 'ra-legal-main--wide' : ''}`}>
        <h1 className="ra-legal-h1">{title}</h1>
        {showLastUpdated && (
          <p className="ra-legal-updated">{t('legal.lastUpdated', { date: '2026-03-24' })}</p>
        )}
        {children}
      </main>
      <Footer />
    </div>
  )
}
