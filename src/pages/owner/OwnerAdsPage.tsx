import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ListingCategory } from '../../types'
import {
  AD_COOLDOWN_DAYS,
  AD_PRICE_EUR,
  adDurationDaysForPlan,
  type AdCategory,
  type AdPlacement,
  computeNextSlotStart,
  createDemoBooking,
  formatAdSlotDate,
} from '../../utils/ownerAds'
import { getEffectiveUnlockedCategories, type OwnerProfile } from '../../utils/ownerSession'

const PLACEMENTS: AdPlacement[] = ['slideshow', 'featured', 'sideSlideshow']

type Props = {
  profile: OwnerProfile
}

export function OwnerAdsPage({ profile }: Props) {
  const { t, i18n } = useTranslation()
  const [step, setStep] = useState<'intro' | 'form'>('intro')
  const [epoch, setEpoch] = useState(0)
  const unlocked = useMemo(() => getEffectiveUnlockedCategories(profile), [profile])
  const [category, setCategory] = useState<AdCategory>(() => unlocked[0] ?? 'accommodation')
  const [placement, setPlacement] = useState<Record<AdPlacement, boolean>>({
    slideshow: true,
    featured: false,
    sideSlideshow: false,
  })

  useEffect(() => {
    const u = unlocked[0]
    if (u && !unlocked.includes(category)) setCategory(u)
  }, [unlocked, category])

  const bump = useCallback(() => setEpoch((e) => e + 1), [])
  useEffect(() => {
    const on = () => bump()
    window.addEventListener('rentadria-owner-ads-updated', on)
    return () => window.removeEventListener('rentadria-owner-ads-updated', on)
  }, [bump])

  const nextStart = useMemo(() => {
    void epoch
    return computeNextSlotStart(profile.userId, category)
  }, [profile.userId, category, epoch])

  const slotLabel = useMemo(
    () => formatAdSlotDate(nextStart, i18n.language === 'en' ? 'en-GB' : 'sr-Latn-ME'),
    [nextStart, i18n.language],
  )

  const isPro = profile.plan === 'pro'
  const adDays = adDurationDaysForPlan(profile.plan)

  const togglePlacement = (p: AdPlacement) => {
    setPlacement((prev) => ({ ...prev, [p]: !prev[p] }))
  }

  const onLease = () => {
    const chosen = PLACEMENTS.filter((p) => placement[p])
    if (!chosen.length) {
      window.alert(t('owner.adsPage.errPlacements'))
      return
    }
    const row = createDemoBooking({
      ownerUserId: profile.userId,
      category,
      placements: chosen,
      durationDays: adDurationDaysForPlan(profile.plan),
    })
    if (row) {
      const loc = i18n.language === 'en' ? 'en-GB' : 'sr-Latn-ME'
      window.alert(
        t('owner.adsPage.successDemo', {
          date: formatAdSlotDate(new Date(row.startAt), loc),
        }),
      )
      bump()
    }
  }

  const catDisabled = (c: ListingCategory) => !unlocked.includes(c)

  return (
    <section className="ra-owner-ads" aria-labelledby="owner-ads-h">
      <div className="ra-owner-ads__head">
        <span className="ra-owner-ads__ico" aria-hidden>
          📣
        </span>
        <h2 id="owner-ads-h" className="ra-owner-ads__title">
          {t('owner.adsPage.title')}
        </h2>
      </div>

      {step === 'intro' ? (
        <>
          <p className="ra-owner-ads__intro">
            {t('owner.adsPage.introBody', { cooldown: AD_COOLDOWN_DAYS })}
          </p>
          <p className="ra-owner-ads__intro ra-owner-ads__intro--popup">
            {t('owner.adsPage.popupNote')}
          </p>
          <button type="button" className="ra-btn ra-btn--primary ra-owner-ads__cta" onClick={() => setStep('form')}>
            {t('owner.adsPage.btnIntro')}
          </button>
        </>
      ) : (
        <div className="ra-owner-ads__form">
          <button type="button" className="ra-btn ra-btn--ghost ra-owner-ads__back" onClick={() => setStep('intro')}>
            {t('owner.adsPage.back')}
          </button>

          <fieldset className="ra-owner-ads__fieldset">
            <legend className="ra-owner-ads__legend">{t('owner.adsPage.pickCategory')}</legend>
            <div className="ra-owner-ads__radios">
              {(['accommodation', 'car', 'motorcycle'] as const).map((c) => (
                <label key={c} className={`ra-owner-ads__radio ${catDisabled(c) ? 'is-disabled' : ''}`}>
                  <input
                    type="radio"
                    name="ad-cat"
                    checked={category === c}
                    disabled={catDisabled(c)}
                    onChange={() => setCategory(c)}
                  />
                  <span>{t(`owner.adsPage.cat_${c}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="ra-owner-ads__slot">
            <p className="ra-owner-ads__slot-label">{t('owner.adsPage.firstSlotLabel')}</p>
            <p className="ra-owner-ads__slot-date">{slotLabel}</p>
            <p className="ra-owner-ads__price">
              {t('owner.adsPage.priceLine', { price: AD_PRICE_EUR, days: adDays })}
            </p>
            <p className="ra-owner-ads__rules-hint">
              {t('owner.adsPage.rulesHint', {
                duration: adDays,
                cooldown: AD_COOLDOWN_DAYS,
              })}
            </p>
          </div>

          <fieldset className="ra-owner-ads__fieldset">
            <legend className="ra-owner-ads__legend">{t('owner.adsPage.pickPlacement')}</legend>
            <p className="ra-owner-ads__placement-hint">{t('owner.adsPage.placementHint')}</p>
            <div className="ra-owner-ads__checks">
              <label className="ra-owner-ads__check">
                <input
                  type="checkbox"
                  checked={placement.slideshow}
                  onChange={() => togglePlacement('slideshow')}
                />
                <span>{t('owner.adsPage.pl_slideshow')}</span>
              </label>
              <label className="ra-owner-ads__check">
                <input
                  type="checkbox"
                  checked={placement.featured}
                  onChange={() => togglePlacement('featured')}
                />
                <span>{t('owner.adsPage.pl_featured')}</span>
              </label>
              <label className="ra-owner-ads__check">
                <input
                  type="checkbox"
                  checked={placement.sideSlideshow}
                  onChange={() => togglePlacement('sideSlideshow')}
                />
                <span>{t('owner.adsPage.pl_sideSlideshow')}</span>
              </label>
            </div>
          </fieldset>

          {isPro && <p className="ra-owner-ads__promo">{t('owner.adsPage.promoPro')}</p>}

          <button
            type="button"
            className={`ra-btn ra-owner-ads__lease ${isPro ? 'ra-btn--lease-pro' : 'ra-btn--lease'}`}
            onClick={onLease}
          >
            {isPro ? t('owner.adsPage.btnLeasePro') : t('owner.adsPage.btnLease', { price: AD_PRICE_EUR })}
          </button>
        </div>
      )}
    </section>
  )
}
