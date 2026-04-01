import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDateDots, type OwnerProfile } from '../../utils/ownerSession'
import { getSavedPromoCode, savePromoCode } from '../../utils/ownerPromoCode'

type Props = {
  profile: OwnerProfile
  refreshProfile: () => void
}

export function OwnerCodePage({ profile, refreshProfile }: Props) {
  const { t } = useTranslation()
  const [epoch, setEpoch] = useState(0)
  const [draft, setDraft] = useState('')

  const bump = useCallback(() => setEpoch((e) => e + 1), [])

  useEffect(() => {
    const on = () => bump()
    window.addEventListener('rentadria-owner-promo-code-updated', on)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'rentadria_owner_promo_code_v1') bump()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('rentadria-owner-promo-code-updated', on)
      window.removeEventListener('storage', onStorage)
    }
  }, [bump])

  const saved = useMemo(() => getSavedPromoCode(profile.userId), [profile.userId, epoch])

  const onSave = () => {
    void (async () => {
    const r = await savePromoCode(profile.userId, draft, profile)
    if (!r.ok) {
      const errKey =
        r.reason === 'empty'
          ? 'owner.codePage.errEmpty'
          : r.reason === 'too_long'
            ? 'owner.codePage.errTooLong'
            : r.reason === 'unknown'
              ? 'owner.codePage.errUnknown'
              : r.reason === 'restricted'
                ? 'owner.codePage.errRestricted'
                : r.reason === 'expired'
                  ? 'owner.codePage.errExpired'
                  : r.reason === 'max_uses'
                    ? 'owner.codePage.errMaxUses'
                    : r.reason === 'country'
                      ? 'owner.codePage.errCountry'
                      : r.reason === 'max_per_country'
                        ? 'owner.codePage.errMaxPerCountry'
                        : 'owner.codePage.errCategory'
      window.alert(t(errKey))
      return
    }
    setDraft('')
    bump()
    refreshProfile()
    })()
  }

  return (
    <section className="ra-owner-code" aria-labelledby="owner-code-h">
      <div className="ra-owner-code__head">
        <span className="ra-owner-code__ico" aria-hidden>
          🎟️
        </span>
        <h2 id="owner-code-h" className="ra-owner-code__title">
          {t('owner.codePage.title')}
        </h2>
      </div>

      <p className="ra-owner-code__lead">{t('owner.codePage.lead')}</p>
      <p className="ra-owner-code__extra">{t('owner.codePage.extra')}</p>

      {saved && (
        <div className="ra-owner-code__saved" role="status">
          <p className="ra-owner-code__saved-label">{t('owner.codePage.savedLabel')}</p>
          <p className="ra-owner-code__saved-code">{saved.code}</p>
          <p className="ra-owner-code__saved-date">{t('owner.codePage.savedAt', { date: formatDateDots(saved.savedAt) })}</p>
        </div>
      )}

      <div className="ra-owner-code__row">
        <label className="ra-owner-code__field ra-fld">
          <span>{t('owner.codePage.fieldLabel')}</span>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('owner.codePage.placeholder')}
            autoComplete="off"
            spellCheck={false}
            maxLength={80}
          />
        </label>
        <button type="button" className="ra-btn ra-btn--primary ra-owner-code__btn" onClick={onSave}>
          {t('owner.codePage.save')}
        </button>
      </div>
    </section>
  )
}
