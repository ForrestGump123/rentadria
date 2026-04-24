import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { OwnerProfile } from '../../utils/ownerSession'
import { getSavedPromoCode, savePromoCode } from '../../utils/ownerPromoCode'

type Props = {
  profile: OwnerProfile
  refreshProfile: () => void
}

export function OwnerCodePage({ profile, refreshProfile }: Props) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const saved = useMemo(() => getSavedPromoCode(profile), [profile])

  const onSave = () => {
    void (async () => {
      if (busy) return
      setBusy(true)
      try {
        const r = await savePromoCode(draft, profile)
        if (!r.ok) {
          const errKey =
            r.reason === 'empty'
              ? 'owner.codePage.errEmpty'
              : r.reason === 'too_long'
                ? 'owner.codePage.errTooLong'
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
                          : r.reason === 'backend_unavailable'
                            ? 'owner.codePage.errBackend'
                            : r.reason === 'admin_override'
                              ? 'owner.codePage.errAdminOverride'
                              : r.reason === 'category'
                                ? 'owner.codePage.errCategory'
                                : 'owner.codePage.errUnknown'
          window.alert(t(errKey))
          return
        }
        setDraft('')
        refreshProfile()
      } finally {
        setBusy(false)
      }
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
            disabled={busy}
          />
        </label>
        <button type="button" className="ra-btn ra-btn--primary ra-owner-code__btn" onClick={onSave} disabled={busy}>
          {busy ? t('owner.codePage.saving') : t('owner.codePage.save')}
        </button>
      </div>
    </section>
  )
}
