import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Logo } from './Logo'
import { MailAtIcon } from './icons/MailAtIcon'
import {
  isRegistrationCountry,
  REGISTRATION_COUNTRIES,
  type RegistrationCountryCode,
} from '../registrationCountries'
import { isValidRegisterPassword } from '../utils/passwordValidation'
import { sha256Hex } from '../utils/passwordHash'
import { isValidRegisterPhone } from '../utils/phoneValidation'
import type { SubscriptionPlan } from '../types/plan'
import { getAdminOwnerMeta } from '../utils/adminOwnerMeta'
import { isEmailInDeletedOwners } from '../utils/deletedOwnersStore'
import { findOwnerProfileByEmail, saveOwnerProfile } from '../utils/ownerSession'
import { fetchAdminLogin } from '../lib/adminAuthApi'
import { setAdminSession } from '../utils/adminSession'
import { sendVerificationEmail } from '../lib/sendVerificationEmail'
import {
  clearPendingRegistrationForEmail,
  registrationCodeToCountryId,
  stashPendingRegistration,
} from '../utils/pendingRegistration'
import { setLoggedIn } from '../utils/storage'

const VERIFY_CTX_KEY = 'rentadria_verify_ctx'

type AuthModalProps = {
  open: boolean
  mode: 'login' | 'register'
  onClose: () => void
  onSwitchMode: (mode: 'login' | 'register') => void
  /** Pre-selected subscription plan (e.g. from pricing page) */
  initialPlan?: SubscriptionPlan | null
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
}

export function AuthModal({ open, mode, onClose, onSwitchMode, initialPlan = null }: AuthModalProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState<string>(() =>
    isRegistrationCountry(i18n.language) ? i18n.language : 'cnr',
  )
  const [promoCode, setPromoCode] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [loginErr, setLoginErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSubmitted(false)
    setLoginErr(null)
    setEmail('')
    setPassword('')
    setShowPassword(false)
    setName('')
    setPhone('')
    setPromoCode('')
    setTermsAccepted(false)
    const lng = i18n.language
    setCountry(isRegistrationCountry(lng) ? lng : 'cnr')
  }, [open, mode, i18n.language])

  if (!open) return null

  const loginSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setLoginErr(null)
    if (!isValidEmail(email) || !password.trim()) return
    const em = email.trim().toLowerCase()

    void (async () => {
      if (isEmailInDeletedOwners(em)) {
        setLoginErr(t('auth.loginAccountDeleted'))
        return
      }
      const existing = findOwnerProfileByEmail(email)
      if (existing) {
        const existingEmail = existing.email.trim().toLowerCase()
        if (existingEmail !== em) {
          setLoginErr(t('auth.loginWrongEmail'))
          return
        }
        if (existing.passwordHash) {
          const h = await sha256Hex(password)
          if (h !== existing.passwordHash) {
            setLoginErr(t('auth.loginPasswordWrong'))
            return
          }
          saveOwnerProfile(existing)
        } else {
          saveOwnerProfile({
            ...existing,
            passwordHash: await sha256Hex(password),
          })
        }
        setLoggedIn(true)
        onClose()
        const blocked = getAdminOwnerMeta(existing.userId).blocked
        navigate(blocked ? '/owner/messages' : '/owner', { replace: true })
        return
      }

      const adminOk = await fetchAdminLogin(email, password)
      if (adminOk) {
        setAdminSession(true)
        setLoggedIn(false)
        onClose()
        navigate('/admin', { replace: true })
        return
      }

      setLoginErr(t('auth.loginPasswordWrong'))
    })()
  }

  const registerSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    const okEmail = isValidEmail(email)
    const okPhone = isValidRegisterPhone(phone)
    const okPw = isValidRegisterPassword(password)
    const okName = name.trim().length > 0
    const okCountry = isRegistrationCountry(country)
    const okTerms = termsAccepted
    if (!okName || !okEmail || !okPhone || !okPw || !okCountry || !okTerms) return
    try {
      sessionStorage.setItem(
        VERIFY_CTX_KEY,
        JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          plan: initialPlan ?? undefined,
        }),
      )
    } catch {
      /* ignore */
    }
    setSending(true)
    try {
      const em = email.trim().toLowerCase()
      const passwordHash = await sha256Hex(password)
      stashPendingRegistration({
        email: em,
        passwordHash,
        phone: phone.trim(),
        countryId: registrationCodeToCountryId(country as RegistrationCountryCode),
        name: name.trim(),
        promoCode: promoCode.trim() || undefined,
      })
      await sendVerificationEmail({
        email: email.trim(),
        name: name.trim(),
        plan: initialPlan ?? 'basic',
      })
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('send-verification (dev, nema API):', err)
      } else {
        clearPendingRegistrationForEmail(email.trim().toLowerCase())
        window.alert(t('auth.verifyEmailSendError'))
        return
      }
    } finally {
      setSending(false)
    }
    navigate('/verify')
    onClose()
  }

  const nameErr = submitted && mode === 'register' && !name.trim()
  const emailErr = submitted && !isValidEmail(email)
  const phoneErr = submitted && mode === 'register' && !isValidRegisterPhone(phone)
  const pwErr =
    submitted &&
    (mode === 'register' ? !isValidRegisterPassword(password) : password.trim().length === 0)
  const termsErr = submitted && mode === 'register' && !termsAccepted

  return (
    <div className="ra-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={onClose}>
      <form
        className="ra-modal__panel ra-auth ra-auth--wide"
        onClick={(e) => e.stopPropagation()}
        onSubmit={mode === 'login' ? loginSubmit : registerSubmit}
      >
        <button type="button" className="ra-modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="ra-modal__brand">
          <Logo variant="modal" />
        </div>
        <h2 id="auth-title">{mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}</h2>
        <p className="ra-auth__subtitle">
          {mode === 'login' ? t('auth.loginSubtitle') : t('auth.registerSubtitle')}
        </p>

        {mode === 'register' && initialPlan && (
          <p className="ra-auth__plan-banner" role="status">
            {t('auth.selectedPlanBanner', {
              plan: t(`pricing.planNames.${initialPlan}`),
            })}
          </p>
        )}

        {mode === 'register' && (
          <>
            <label className={`ra-fld ${nameErr ? 'ra-fld--error' : ''}`}>
              <span>{t('auth.nameLabel')}</span>
              <input
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('auth.namePlaceholder')}
                aria-invalid={nameErr}
              />
              <span className="ra-fld__hint">{t('auth.nameHint')}</span>
              {nameErr && <span className="ra-fld__err">{t('auth.nameError')}</span>}
            </label>
          </>
        )}

        <label className={`ra-fld ${emailErr ? 'ra-fld--error' : ''}`}>
          <span>{t('auth.email')}</span>
          <div className="ra-fld__email-row">
            <span className="ra-fld__email-ico">
              <MailAtIcon />
            </span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              aria-invalid={emailErr}
            />
          </div>
          {emailErr && <span className="ra-fld__err">{t('auth.emailError')}</span>}
        </label>

        {mode === 'register' && (
          <label className={`ra-fld ${phoneErr ? 'ra-fld--error' : ''}`}>
            <span>{t('auth.phoneLabel')}</span>
            <input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('auth.phonePlaceholder')}
              aria-invalid={phoneErr}
            />
            <span className="ra-fld__hint">{t('auth.phoneHint')}</span>
            {phoneErr && <span className="ra-fld__err">{t('auth.phoneError')}</span>}
          </label>
        )}

        {mode === 'register' && (
          <label className="ra-fld">
            <span>{t('auth.countryLabel')}</span>
            <select value={country} onChange={(e) => setCountry(e.target.value)} required>
              {REGISTRATION_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {t(`auth.countries.${c.code}`)}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className={`ra-fld ra-fld--pw ${pwErr ? 'ra-fld--error' : ''}`}>
          <span>{t('auth.password')}</span>
          <div className="ra-fld__pw-row">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
              aria-invalid={pwErr}
            />
            <button
              type="button"
              className="ra-fld__pw-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 114.243-4.244M1 1l22 22" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {mode === 'register' && <span className="ra-fld__hint">{t('auth.passwordHint')}</span>}
          {pwErr && (
            <span className="ra-fld__err">
              {mode === 'register' ? t('auth.passwordError') : t('auth.passwordRequired')}
            </span>
          )}
          {mode === 'login' && loginErr && <span className="ra-fld__err">{loginErr}</span>}
        </label>

        {mode === 'register' && (
          <label className="ra-fld">
            <span>{t('auth.promoCodeLabel')}</span>
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder={t('auth.promoCodePlaceholder')}
            />
            <span className="ra-fld__hint">{t('auth.promoCodeHint')}</span>
          </label>
        )}

        {mode === 'register' && (
          <p className="ra-auth__verify-note">{t('auth.verifyEmailOnly')}</p>
        )}

        {mode === 'register' && (
          <div className={`ra-auth-terms ${termsErr ? 'ra-auth-terms--error' : ''}`}>
            <label className="ra-verify__row ra-verify__row--multiline">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <span>
                <Trans
                  i18nKey="auth.termsConsent"
                  components={{
                    terms: (
                      <Link to="/terms?from=register" className="ra-auth-inline-link" onClick={onClose} />
                    ),
                    privacy: (
                      <Link to="/privacy?from=register" className="ra-auth-inline-link" onClick={onClose} />
                    ),
                  }}
                />
              </span>
            </label>
            {termsErr && <span className="ra-fld__err">{t('auth.termsConsentError')}</span>}
          </div>
        )}

        <button type="submit" className="ra-btn ra-btn--primary ra-btn--block" disabled={sending}>
          {sending
            ? t('auth.sendingVerification')
            : mode === 'login'
              ? t('auth.submitLogin')
              : t('auth.submitRegister')}
        </button>

        <p className="ra-auth__switch">
          {mode === 'login' ? (
            <>
              <span className="ra-auth__switch-prefix">{t('auth.switchToRegisterPrefix')} </span>
              <button type="button" className="ra-link-btn" onClick={() => onSwitchMode('register')}>
                {t('auth.switchToRegisterLink')}
              </button>
            </>
          ) : (
            <>
              <span className="ra-auth__switch-prefix">{t('auth.switchToLoginPrefix')} </span>
              <button type="button" className="ra-link-btn" onClick={() => onSwitchMode('login')}>
                {t('auth.switchToLoginLink')}
              </button>
            </>
          )}
        </p>
      </form>
    </div>
  )
}
