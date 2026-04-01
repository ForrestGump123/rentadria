import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CookiePrefs } from '../utils/cookieConsent'
import { hasCookieDecision, readCookiePrefs, saveCookiePrefs } from '../utils/cookieConsent'

const LEGACY_V1 = 'rentadria_cookie_consent_v1'

function migrateLegacyV1(): void {
  try {
    if (typeof localStorage === 'undefined') return
    if (localStorage.getItem(LEGACY_V1) === '1') {
      saveCookiePrefs({ essential: true, analytics: true })
      localStorage.removeItem(LEGACY_V1)
    }
  } catch {
    /* ignore */
  }
}

export function CookieBanner() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [analytics, setAnalytics] = useState(false)

  useEffect(() => {
    migrateLegacyV1()
    try {
      if (typeof localStorage === 'undefined') return
      if (!hasCookieDecision()) setVisible(true)
      const p = readCookiePrefs()
      if (p) setAnalytics(p.analytics)
    } catch {
      setVisible(true)
    }
  }, [])

  useEffect(() => {
    const onOpen = () => {
      setVisible(true)
      setCustomOpen(false)
    }
    window.addEventListener('rentadria-open-cookie-settings', onOpen)
    return () => window.removeEventListener('rentadria-open-cookie-settings', onOpen)
  }, [])

  const close = useCallback((prefs: CookiePrefs) => {
    saveCookiePrefs(prefs)
    setVisible(false)
    setCustomOpen(false)
  }, [])

  const acceptAll = useCallback(() => {
    close({ essential: true, analytics: true })
  }, [close])

  const essentialOnly = useCallback(() => {
    close({ essential: true, analytics: false })
  }, [close])

  const saveCustom = useCallback(() => {
    close({ essential: true, analytics })
  }, [close, analytics])

  if (!visible) return null

  return (
    <div className="ra-cookie" role="dialog" aria-labelledby="cookie-title">
      <div className="ra-cookie__inner">
        <p id="cookie-title" className="ra-cookie__text">
          {t('cookie.message')}
        </p>
        {!customOpen ? (
          <div className="ra-cookie__actions">
            <button type="button" className="ra-btn ra-btn--ghost" onClick={() => setCustomOpen(true)}>
              {t('cookie.customize')}
            </button>
            <button type="button" className="ra-btn ra-btn--ghost" onClick={essentialOnly}>
              {t('cookie.essentialOnly')}
            </button>
            <button type="button" className="ra-btn ra-btn--primary" onClick={acceptAll}>
              {t('cookie.acceptAll')}
            </button>
          </div>
        ) : (
          <div className="ra-cookie__custom">
            <p className="ra-cookie__custom-hint">{t('cookie.customizeHint')}</p>
            <label className="ra-cookie__row">
              <input type="checkbox" checked disabled />
              <span>
                <strong>{t('cookie.essentialLabel')}</strong>
                <span className="ra-cookie__row-desc">{t('cookie.essentialDesc')}</span>
              </span>
            </label>
            <label className="ra-cookie__row">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
              />
              <span>
                <strong>{t('cookie.analyticsLabel')}</strong>
                <span className="ra-cookie__row-desc">{t('cookie.analyticsDesc')}</span>
              </span>
            </label>
            <div className="ra-cookie__actions ra-cookie__actions--custom">
              <button type="button" className="ra-btn ra-btn--ghost" onClick={() => setCustomOpen(false)}>
                {t('cookie.back')}
              </button>
              <button type="button" className="ra-btn ra-btn--primary" onClick={saveCustom}>
                {t('cookie.savePrefs')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
