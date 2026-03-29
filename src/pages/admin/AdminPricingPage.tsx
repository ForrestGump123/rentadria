import { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import {
  getPricingPlans,
  type PricingPlanDef,
  resolvePricingLocale,
} from '../../content/pricingPlans'
import { isAdminSession } from '../../utils/adminSession'
import { savePricingOverride } from '../../utils/pricingOverrides'

export function AdminPricingPage() {
  const { t, i18n } = useTranslation()
  const loc = resolvePricingLocale(i18n.language)
  const [epoch, setEpoch] = useState(0)
  const [editing, setEditing] = useState<PricingPlanDef | null>(null)

  const plans = useMemo(() => {
    void epoch
    return getPricingPlans(i18n.language)
  }, [i18n.language, epoch])

  const bump = useCallback(() => setEpoch((e) => e + 1), [])

  useEffect(() => {
    const on = () => bump()
    window.addEventListener('rentadria-pricing-overrides-updated', on)
    return () => window.removeEventListener('rentadria-pricing-overrides-updated', on)
  }, [bump])

  const onSaveEdit = () => {
    if (!editing) return
    const next = plans.map((p) => (p.id === editing.id ? editing : p))
    savePricingOverride(loc, next)
    setEditing(null)
    bump()
  }

  const onReset = () => {
    if (!window.confirm(t('admin.pricingAdmin.confirmReset'))) return
    const b = JSON.parse(localStorage.getItem('rentadria_pricing_plans_override_v1') ?? '{}') as Record<
      string,
      unknown
    >
    delete b[loc]
    localStorage.setItem('rentadria_pricing_plans_override_v1', JSON.stringify(b))
    bump()
  }

  if (!isAdminSession()) return null

  return (
    <div className="ra-admin-pricing-admin">
      <Helmet>
        <title>{t('admin.nav.pricing')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <header className="ra-admin-head">
        <h1 className="ra-admin-title">{t('admin.pricingAdmin.title')}</h1>
        <p className="ra-admin-subtitle">{t('admin.pricingAdmin.lead')}</p>
        <button type="button" className="ra-btn" onClick={onReset}>
          {t('admin.pricingAdmin.resetDefaults')}
        </button>
      </header>

      <div className="ra-pricing-grid">
        {plans.map((p) => (
          <article key={p.id} className={`ra-pricing-card ${p.popular ? 'ra-pricing-card--popular' : ''}`}>
            <div className="ra-pricing-card__head">
              <h2 className="ra-pricing-card__name">{p.name}</h2>
              {p.popular && <span className="ra-pricing-card__badge">{t('pricing.badgePopular')}</span>}
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
            <button type="button" className="ra-btn ra-btn--primary ra-btn--sm" onClick={() => setEditing({ ...p })}>
              {t('admin.pricingAdmin.edit')}
            </button>
          </article>
        ))}
      </div>

      <p className="ra-admin-pricing-admin__hint">{t('admin.pricingAdmin.hint')}</p>

      {editing && (
        <div className="ra-modal" role="dialog" onClick={() => setEditing(null)}>
          <div className="ra-modal__panel ra-admin-owners__modal ra-admin-owners__modal--wide" onClick={(e) => e.stopPropagation()}>
            <h2 className="ra-admin-title">{t('admin.pricingAdmin.editTitle')}</h2>
            <label className="ra-fld">
              <span>{t('admin.pricingAdmin.fldName')}</span>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </label>
            <label className="ra-fld">
              <span>{t('admin.pricingAdmin.fldTagline')}</span>
              <input value={editing.tagline} onChange={(e) => setEditing({ ...editing, tagline: e.target.value })} />
            </label>
            <label className="ra-fld">
              <span>{t('admin.pricingAdmin.fldPrice')}</span>
              <input value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} />
            </label>
            <label className="ra-fld">
              <span>{t('admin.pricingAdmin.fldFeatures')}</span>
              <textarea
                rows={10}
                value={editing.features.join('\n')}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    features: e.target.value
                      .split('\n')
                      .map((x) => x.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
            <label className="ra-fld ra-fld--row">
              <input
                type="checkbox"
                checked={Boolean(editing.popular)}
                onChange={(e) => setEditing({ ...editing, popular: e.target.checked })}
              />
              <span>{t('admin.pricingAdmin.popular')}</span>
            </label>
            <div className="ra-admin-pricing-admin__modal-actions">
              <button type="button" className="ra-btn ra-btn--primary" onClick={onSaveEdit}>
                {t('admin.pricingAdmin.save')}
              </button>
              <button type="button" className="ra-btn" onClick={() => setEditing(null)}>
                {t('admin.pricingAdmin.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
