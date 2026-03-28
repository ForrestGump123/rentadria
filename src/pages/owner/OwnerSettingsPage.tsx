import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getPricingPlans } from '../../content/pricingPlans'
import type { SubscriptionPlan } from '../../types/plan'
import {
  getInquiryNotificationPrefs,
  saveInquiryNotificationPrefs,
  type InquiryNotificationPrefs,
} from '../../utils/inquiryNotificationPrefs'
import {
  activateOwnerSubscription,
  clearOwnerSession,
  formatDateDots,
  type OwnerProfile,
} from '../../utils/ownerSession'

type Props = {
  profile: OwnerProfile
  refreshProfile: () => void
}

export function OwnerSettingsPage({ profile, refreshProfile }: Props) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const pricingPlans = useMemo(() => getPricingPlans(i18n.language), [i18n.language])

  const [prefs, setPrefs] = useState<InquiryNotificationPrefs>(() =>
    getInquiryNotificationPrefs(profile.userId),
  )
  const [savedFlash, setSavedFlash] = useState(false)

  const planLabel = profile.plan ? t(`pricing.planNames.${profile.plan}`) : '—'

  const onSaveNotif = () => {
    saveInquiryNotificationPrefs(profile.userId, prefs)
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 2500)
  }

  const selectPlan = (planId: SubscriptionPlan) => {
    if (profile.plan === planId) return
    activateOwnerSubscription(profile, planId)
    refreshProfile()
  }

  const onDeleteAccount = () => {
    if (!window.confirm(t('owner.settingsPage.deleteConfirm'))) return
    clearOwnerSession()
    navigate('/', { replace: true })
  }

  return (
    <section className="ra-owner-settings" aria-labelledby="owner-settings-h">
      <header className="ra-owner-settings__head">
        <span className="ra-owner-settings__gear" aria-hidden>
          ⚙️
        </span>
        <div>
          <h1 id="owner-settings-h" className="ra-owner-settings__title">
            {t('owner.settingsPage.title')}
          </h1>
          <p className="ra-owner-settings__sub">{t('owner.settingsPage.yourPlan')}</p>
          <p className="ra-owner-settings__plan-line">
            {t('owner.settingsPage.currentPlanLine', {
              plan: planLabel,
              status: t('owner.settingsPage.statusActive'),
            })}
          </p>
          {profile.plan && (
            <p className="ra-owner-settings__plan-meta">
              {t('owner.datesBanner', {
                registered: formatDateDots(profile.registeredAt),
                validUntil: formatDateDots(profile.validUntil),
              })}
            </p>
          )}
        </div>
      </header>

      <div className="ra-pricing-grid ra-owner-settings__plans">
        {pricingPlans.map((p) => {
          const isCurrent = profile.plan === p.id
          return (
            <button
              key={p.id}
              type="button"
              disabled={isCurrent}
              className={`ra-pricing-card ra-owner-settings__plan-btn ${p.popular ? 'ra-pricing-card--popular' : ''} ${isCurrent ? 'ra-owner-settings__plan-btn--current' : ''}`}
              onClick={() => selectPlan(p.id)}
            >
              <div className="ra-pricing-card__head">
                <div className="ra-pricing-card__title-row">
                  <h3 className="ra-pricing-card__name">{p.name}</h3>
                  {p.popular && <span className="ra-pricing-card__badge">{t('pricing.badgePopular')}</span>}
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
              {isCurrent ? (
                <p className="ra-owner-settings__active" role="status">
                  ✓ {t('owner.settingsPage.active')}
                </p>
              ) : (
                <span className="ra-btn ra-btn--primary ra-pricing-card__cta">{t('owner.settingsPage.upgrade')}</span>
              )}
            </button>
          )
        })}
      </div>

      <div className="ra-owner-settings__notif">
        <h2 className="ra-owner-settings__notif-title">{t('owner.settingsPage.notifTitle')}</h2>
        <p className="ra-owner-settings__notif-lead">{t('owner.settingsPage.notifLead')}</p>

        <label className="ra-owner-settings__check ra-check">
          <input
            type="checkbox"
            checked={prefs.receiveEnabled}
            onChange={(e) => setPrefs((x) => ({ ...x, receiveEnabled: e.target.checked }))}
          />
          <span>{t('owner.settingsPage.receiveToggle')}</span>
        </label>

        <p className="ra-owner-settings__how">{t('owner.settingsPage.howLabel')}</p>

        <label className="ra-owner-settings__check ra-check">
          <input
            type="checkbox"
            checked={prefs.emailChannel}
            disabled={!prefs.receiveEnabled}
            onChange={(e) => setPrefs((x) => ({ ...x, emailChannel: e.target.checked }))}
          />
          <span>{t('owner.settingsPage.channelEmail')}</span>
        </label>

        <label className="ra-owner-settings__check ra-check">
          <input
            type="checkbox"
            checked={prefs.dashboardChannel}
            disabled={!prefs.receiveEnabled}
            onChange={(e) => setPrefs((x) => ({ ...x, dashboardChannel: e.target.checked }))}
          />
          <span>{t('owner.settingsPage.channelDashboard')}</span>
        </label>

        <button type="button" className="ra-btn ra-btn--primary" onClick={onSaveNotif}>
          {t('owner.settingsPage.saveBtn')}
        </button>
        {savedFlash && <p className="ra-owner-settings__saved">{t('owner.settingsPage.saved')}</p>}
      </div>

      <div className="ra-owner-settings__danger">
        <h2 className="ra-owner-settings__danger-title">{t('owner.settingsPage.deleteTitle')}</h2>
        <p className="ra-owner-settings__danger-lead">{t('owner.settingsPage.deleteLead')}</p>
        <button type="button" className="ra-btn ra-btn--outline-danger" onClick={onDeleteAccount}>
          {t('owner.settingsPage.deleteBtn')}
        </button>
      </div>
    </section>
  )
}
