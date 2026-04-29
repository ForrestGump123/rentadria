import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { verifyOwnerLoginLink } from '../lib/ownerLoginLink'
import { pullOwnerListingsFromCloud } from '../lib/ownerCloudSync'
import { pullOwnerProfileFromCloud } from '../lib/ownerProfileCloud'
import { saveOwnerProfile } from '../utils/ownerSession'

export function OwnerLoginLinkPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setErr(t('auth.loginLinkInvalid'))
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setErr(null)
    void verifyOwnerLoginLink(token)
      .then(async (r) => {
        if (cancelled) return
        if (!r.ok) {
          setErr(
            r.error === 'owner_deleted'
              ? t('auth.loginAccountDeleted')
              : r.error === 'owner_not_found'
                ? t('auth.loginNotRegistered')
                : t('auth.loginLinkInvalid'),
          )
          setLoading(false)
          return
        }
        saveOwnerProfile(r.profile)
        await Promise.all([pullOwnerListingsFromCloud(r.profile.userId), pullOwnerProfileFromCloud(r.profile.userId)])
        navigate('/owner', { replace: true })
      })
      .catch(() => {
        if (!cancelled) {
          setErr(t('auth.loginLinkInvalid'))
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [token, navigate, t])

  if (loading) {
    return (
      <div className="ra-app ra-verify-page">
        <Helmet>
          <title>{t('auth.loginTitle')} · RentAdria</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <main className="ra-main ra-verify-main">
          <p>{t('auth.loginLinkSigningIn')}</p>
        </main>
        <Footer />
      </div>
    )
  }

  if (err) {
    return (
      <div className="ra-app ra-verify-page">
        <Helmet>
          <title>{t('auth.loginTitle')} · RentAdria</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <main className="ra-main ra-verify-main">
          <h1>{t('auth.loginTitle')}</h1>
          <p className="ra-verify-hint ra-verify-hint--err">{err}</p>
          <p className="ra-verify-back">
            <Link to="/">{t('verify.back')}</Link>
          </p>
        </main>
        <Footer />
      </div>
    )
  }

  return null
}

