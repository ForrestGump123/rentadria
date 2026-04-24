import { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import {
  getPricingPlans,
  type PricingPlanDef,
  resolvePricingLocale,
} from '../../content/pricingPlans'
import { isAdminSession } from '../../utils/adminSession'
import { pullPricingOverride, resetPricingOverride, savePricingOverride, type PricingLocale } from '../../utils/pricingOverrides'
import { PLAN_IDS, type SubscriptionPlan } from '../../types/plan'

function newEmptyPlan(): PricingPlanDef {
  return {
    id: `plan-${Date.now()}`,
    name: 'Plan',
    tagline: '',
    price: '0',
    features: [''],
    mapsToPlan: null,
  }
}

export function AdminPricingPage() {
  const { t, i18n } = useTranslation()
  const loc = resolvePricingLocale(i18n.language)
  const [epoch, setEpoch] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const [editing, setEditing] = useState<PricingPlanDef | null>(null)
  const [isNew, setIsNew] = useState(false)
  const adminOk = isAdminSession()

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

  const persistPlans = (next: PricingPlanDef[]) => {
    void (async () => {
      const ok = await savePricingOverride(loc as PricingLocale, next)
      if (!ok) {
        window.alert(t('admin.owners.serverSaveError', { detail: 'save_failed' }))
        return
      }
      bump()
    })()
  }

  const onSaveEdit = () => {
    if (!editing) return
    const id = editing.id.trim()
    if (!id) {
      window.alert(t('admin.pricingAdmin.errId'))
      return
    }
    const next = isNew ? [...plans, { ...editing, id }] : plans.map((p) => (p.id === editing.id ? { ...editing, id } : p))
    persistPlans(next)
    setEditing(null)
    setIsNew(false)
  }

  const onAddPlan = () => {
    setIsNew(true)
    setEditing(newEmptyPlan())
  }

  const onDeleteEditing = () => {
    if (!editing || isNew) {
      setEditing(null)
      setIsNew(false)
      return
    }
    if (!window.confirm(t('admin.pricingAdmin.confirmDelete'))) return
    persistPlans(plans.filter((p) => p.id !== editing.id))
    setEditing(null)
  }

  const onReset = () => {
    if (!window.confirm(t('admin.pricingAdmin.confirmReset'))) return
    void (async () => {
      const ok = await resetPricingOverride(loc as PricingLocale)
      if (!ok) {
        window.alert(t('admin.owners.serverSaveError', { detail: 'reset_failed' }))
        return
      }
      bump()
    })()
  }

  // Ensure server overrides are loaded for this locale (if present).
  useEffect(() => {
    if (!adminOk) return
    void pullPricingOverride(loc as PricingLocale).then((r) => {
      setLoadError(r === null)
      bump()
    })
  }, [adminOk, loc, bump])

  if (!adminOk) return null

  return (
    <div className="ra-admin-pricing-admin">
      <Helmet>
        <title>{t('admin.nav.pricing')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <header className="ra-admin-head">
        <h1 className="ra-admin-title">{t('admin.pricingAdmin.title')}</h1>
        <p className="ra-admin-subtitle">{t('admin.pricingAdmin.lead')}</p>
        {loadError ? <p className="ra-admin-listings__hint">{t('admin.pricingAdmin.loadError')}</p> : null}
        <div className="ra-admin-pricing-admin__toolbar">
          <button type="button" className="ra-btn ra-btn--primary" onClick={onAddPlan}>
            {t('admin.pricingAdmin.addPlan')}
          </button>
          <button type="button" className="ra-btn" onClick={onReset}>
            {t('admin.pricingAdmin.resetDefaults')}
          </button>
        </div>
      </header>

      <div className="ra-pricing-grid ra-admin-pricing-admin__grid">
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
            <button
              type="button"
              className="ra-btn ra-btn--primary ra-btn--sm"
              onClick={() => {
                setIsNew(false)
                setEditing({ ...p })
              }}
            >
              {t('admin.pricingAdmin.edit')}
            </button>
          </article>
        ))}
      </div>

      <p className="ra-admin-pricing-admin__hint">{t('admin.pricingAdmin.hint')}</p>

      {editing && (
        <div
          className="ra-modal"
          role="dialog"
          onClick={() => {
            setEditing(null)
            setIsNew(false)
          }}
        >
          <div
            className="ra-modal__panel ra-admin-owners__modal ra-admin-owners__modal--wide"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="ra-admin-title">{t('admin.pricingAdmin.editTitle')}</h2>
            <label className="ra-fld">
              <span>{t('admin.pricingAdmin.fldId')}</span>
              <input
                value={editing.id}
                disabled={!isNew}
                onChange={(e) => setEditing({ ...editing, id: e.target.value })}
              />
            </label>
            <label className="ra-fld">
              <span>{t('admin.pricingAdmin.fldName')}</span>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </label>
            <label className="ra-fld">
              <span>{t('admin.pricingAdmin.fldTagline')}</span>
              <input
                value={editing.tagline}
                onChange={(e) => setEditing({ ...editing, tagline: e.target.value })}
              />
            </label>
            <label className="ra-fld">
              <span>{t('admin.pricingAdmin.fldPrice')}</span>
              <input value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} />
            </label>
            <label className="ra-fld">
              <span>{t('admin.pricingAdmin.fldMapsToPlan')}</span>
              <select
                value={editing.mapsToPlan ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  setEditing({
                    ...editing,
                    mapsToPlan: v === '' ? null : (v as SubscriptionPlan),
                  })
                }}
              >
                <option value="">{t('admin.pricingAdmin.mapsNone')}</option>
                {PLAN_IDS.map((id) => (
                  <option key={id} value={id}>
                    {t(`pricing.planNames.${id}`)}
                  </option>
                ))}
              </select>
            </label>
            <p className="ra-admin-pricing-admin__field-hint">{t('admin.pricingAdmin.mapsHint')}</p>
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
              {!isNew && (
                <button type="button" className="ra-btn ra-admin-listings__btn-del" onClick={onDeleteEditing}>
                  {t('admin.pricingAdmin.deletePlan')}
                </button>
              )}
              <button
                type="button"
                className="ra-btn"
                onClick={() => {
                  setEditing(null)
                  setIsNew(false)
                }}
              >
                {t('admin.pricingAdmin.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
