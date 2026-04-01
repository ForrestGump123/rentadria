import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { verifyEmailToken } from '../lib/verifyEmailToken'
import { takePendingRegistration } from '../utils/pendingRegistration'
import { savePromoCode } from '../utils/ownerPromoCode'
import { getOwnerProfile, saveOwnerProfile, type OwnerProfile } from '../utils/ownerSession'

const STORAGE_KEY = 'rentadria_verify_ctx'

export function VerifyCodePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(!!token)
  const [tokenErr, setTokenErr] = useState<string | null>(null)

  useEffect(() => {
    if (token) {
      let cancelled = false
      setLoading(true)
      setTokenErr(null)
      void verifyEmailToken(token)
        .then(async (data) => {
          if (cancelled) return
          const pending = takePendingRegistration(data.email)
          const profile: OwnerProfile = {
            userId: data.email,
            email: data.email,
            displayName: data.name.trim() || data.email.split('@')[0],
            plan: null,
            subscriptionActive: false,
            registeredAt: new Date().toISOString(),
            validUntil: '',
            phone: pending?.phone,
            countryId: pending?.countryId,
            passwordHash: pending?.passwordHash,
          }
          saveOwnerProfile(profile)
          const p = getOwnerProfile()
          if (p && pending?.promoCode?.trim()) {
            const r = await savePromoCode(p.userId, pending.promoCode, p)
            if (!r.ok && import.meta.env.DEV) {
              console.warn('[RentAdria] Promo kod pri registraciji nije primijenjen:', r.reason)
            }
          }
          try {
            sessionStorage.removeItem(STORAGE_KEY)
          } catch {
            /* ignore */
          }
          navigate('/owner', { replace: true })
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : ''
            const msg = err instanceof Error ? err.message : ''
            const key =
              code === 'token_expired' || msg === 'token_expired'
                ? 'verify.tokenExpired'
                : code === 'server_misconfigured' ||
                    msg === 'server_misconfigured' ||
                    code === 'bad_response' ||
                    msg === 'bad_response'
                  ? 'verify.serverError'
                  : 'verify.tokenError'
            setTokenErr(t(key))
            setLoading(false)
          }
        })
      return () => {
        cancelled = true
      }
    }

    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw) {
        navigate('/', { replace: true })
        return
      }
      const ctx = JSON.parse(raw) as { email?: string }
      if (ctx.email) setEmail(ctx.email)
    } catch {
      navigate('/', { replace: true })
    }
    return undefined
  }, [token, navigate, t])

  if (token && loading) {
    return (
      <div className="ra-app ra-verify-page">
        <Helmet>
          <title>{t('verify.title')} · RentAdria</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <main className="ra-main ra-verify-main">
          <p>{t('verify.verifying')}</p>
        </main>
        <Footer />
      </div>
    )
  }

  if (token && tokenErr) {
    return (
      <div className="ra-app ra-verify-page">
        <Helmet>
          <title>{t('verify.title')} · RentAdria</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <main className="ra-main ra-verify-main">
          <h1>{t('verify.title')}</h1>
          <p className="ra-verify-hint ra-verify-hint--err">{tokenErr}</p>
          <p className="ra-verify-back">
            <Link to="/">{t('verify.back')}</Link>
          </p>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="ra-app ra-verify-page">
      <Helmet>
        <title>{t('verify.title')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <main className="ra-main ra-verify-main">
        <h1>{t('verify.title')}</h1>
        <p className="ra-verify-hint">{t('verify.checkEmailInstruction', { email: email || '—' })}</p>
        <p className="ra-verify-hint">{t('verify.checkEmailSpam')}</p>
        <p className="ra-verify-back">
          <Link to="/">{t('verify.back')}</Link>
        </p>
      </main>
      <Footer />
    </div>
  )
}
