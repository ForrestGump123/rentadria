import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { LegalShell } from '../components/LegalShell'
import { getPricingPlans } from '../content/pricingPlans'
import type { SubscriptionPlan } from '../types/plan'
import { isLoggedIn } from '../utils/storage'

const PENDING_PLAN_KEY = 'rentadria_pending_plan'

export function PricingPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const plans = useMemo(() => getPricingPlans(i18n.language), [i18n.language])

  const onSelectPlan = (plan: SubscriptionPlan) => {
    if (isLoggedIn()) {
      window.alert(t('pricing.loggedInHint'))
      return
    }
    try {
      sessionStorage.setItem(PENDING_PLAN_KEY, plan)
    } catch {
      /* ignore */
    }
    navigate('/?register=1')
  }

  return (
    <LegalShell title={t('pricing.pageTitle')} showLastUpdated={false} wide>
      <p className="ra-pricing-subtitle">{t('pricing.subtitle')}</p>
      <div className="ra-pricing-grid">
        {plans.map((p) => (
          <article
            key={p.id}
            className={`ra-pricing-card ${p.popular ? 'ra-pricing-card--popular' : ''}`}
          >
            <div className="ra-pricing-card__head">
              <div className="ra-pricing-card__title-row">
                <h2 className="ra-pricing-card__name">{p.name}</h2>
                {p.popular && (
                  <span className="ra-pricing-card__badge">{t('pricing.badgePopular')}</span>
                )}
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
              onClick={() => onSelectPlan(p.id)}
            >
              {t('pricing.selectPlan')}
            </button>
          </article>
        ))}
      </div>
    </LegalShell>
  )
}
