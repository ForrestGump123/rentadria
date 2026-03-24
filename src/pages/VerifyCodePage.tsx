import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { isSubscriptionPlan } from '../types/plan'
import {
  addOneYearIso,
  saveOwnerProfile,
  seedOwnerListingsIfEmpty,
  type OwnerProfile,
} from '../utils/ownerSession'

const STORAGE_KEY = 'rentadria_verify_ctx'

export function VerifyCodePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
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
  }, [navigate])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const ctx = JSON.parse(raw) as { email?: string; name?: string; plan?: string }
        const email = (ctx.email ?? '').trim().toLowerCase()
        if (email) {
          const plan = isSubscriptionPlan(ctx.plan) ? ctx.plan : 'basic'
          const displayName = (ctx.name ?? '').trim() || email.split('@')[0]
          const profile: OwnerProfile = {
            userId: email,
            email,
            displayName,
            plan,
            registeredAt: new Date().toISOString(),
            validUntil: addOneYearIso(),
          }
          saveOwnerProfile(profile)
          seedOwnerListingsIfEmpty(profile)
        }
      }
    } catch {
      /* ignore */
    }
    sessionStorage.removeItem(STORAGE_KEY)
    navigate('/owner', { replace: true })
  }

  return (
    <div className="ra-app ra-verify-page">
      <Helmet>
        <title>{t('verify.title')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <main className="ra-main ra-verify-main">
        <h1>{t('verify.title')}</h1>
        <p className="ra-verify-hint">{t('verify.hint', { email: email || '—' })}</p>
        <form className="ra-verify-form" onSubmit={submit}>
          <label className="ra-fld">
            <span>{t('verify.codeLabel')}</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder={t('verify.placeholder')}
            />
          </label>
          <button type="submit" className="ra-btn ra-btn--primary ra-btn--block">
            {t('verify.submit')}
          </button>
        </form>
        <p className="ra-verify-back">
          <Link to="/">{t('verify.back')}</Link>
        </p>
      </main>
      <Footer />
    </div>
  )
}
