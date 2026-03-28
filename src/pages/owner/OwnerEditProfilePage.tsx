import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { fileToResizedJpegDataUrl } from '../../utils/imageDataUrl'
import { sha256Hex } from '../../utils/passwordHash'
import { isValidRegisterPassword } from '../../utils/passwordValidation'
import { saveOwnerProfile, type OwnerProfile } from '../../utils/ownerSession'

type Props = {
  profile: OwnerProfile
  refreshProfile: () => void
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        fill="currentColor"
        d="M12 9a3 3 0 100 6 3 3 0 000-6zm0-7C7 7 2.73 10.11 1 14.5 2.73 18.89 7 22 12 22s9.27-3.11 11-7.5C21.27 10.11 17 7 12 7zm0 12.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        fill="currentColor"
        d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 001 14.5C2.73 18.89 7 22 12 22c1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.33-.08.66-.08 1 0 2.76 2.24 5 5 5 .34 0 .67-.03 1-.09l1.66 1.66A6.96 6.96 0 0112 17c-3.87 0-7-3.13-7-7 0-1.17.29-2.27.8-3.2z"
      />
    </svg>
  )
}

function LockMailIcon() {
  return (
    <span className="ra-fld__locked-ico" aria-hidden>
      <svg viewBox="0 0 24 24" width="22" height="22">
        <path
          fill="currentColor"
          d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"
        />
      </svg>
    </span>
  )
}

export function OwnerEditProfilePage({ profile, refreshProfile }: Props) {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState(profile.displayName)
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(profile.avatarDataUrl ?? null)

  const [oldPw1, setOldPw1] = useState('')
  const [oldPw2, setOldPw2] = useState('')
  const [newPw, setNewPw] = useState('')
  const [showOld1, setShowOld1] = useState(false)
  const [showOld2, setShowOld2] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setDisplayName(profile.displayName)
    setPhone(profile.phone ?? '')
    setAvatarDataUrl(profile.avatarDataUrl ?? null)
  }, [profile.userId, profile.displayName, profile.phone, profile.avatarDataUrl])

  const onPickFile = () => fileRef.current?.click()

  const onFile = async (files: FileList | null) => {
    const f = files?.[0]
    if (!f || !f.type.startsWith('image/')) return
    setErr(null)
    try {
      const dataUrl = await fileToResizedJpegDataUrl(f, 400)
      if (dataUrl.length > 1_200_000) {
        setErr(t('owner.profilePage.errAvatarTooLarge'))
        return
      }
      setAvatarDataUrl(dataUrl)
    } catch {
      setErr(t('owner.profilePage.errAvatarRead'))
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    setOk(false)
    const nameTrim = displayName.trim()
    if (!nameTrim) {
      setErr(t('owner.profilePage.errName'))
      return
    }

    const o1 = oldPw1.trim()
    const o2 = oldPw2.trim()
    const nw = newPw.trim()

    if (nw) {
      if (!isValidRegisterPassword(nw)) {
        setErr(t('owner.profilePage.errNewPasswordRules'))
        return
      }
      if (profile.passwordHash) {
        if (o1 !== o2) {
          setErr(t('owner.profilePage.errOldMismatch'))
          return
        }
        const oldHash = await sha256Hex(o1)
        if (oldHash !== profile.passwordHash) {
          setErr(t('owner.profilePage.errOldWrong'))
          return
        }
      }
    }

    setBusy(true)
    try {
      let nextHash = profile.passwordHash
      if (nw) {
        nextHash = await sha256Hex(nw)
      }

      const next: OwnerProfile = {
        ...profile,
        displayName: nameTrim,
        phone: phone.trim() || undefined,
        avatarDataUrl: avatarDataUrl ?? null,
        passwordHash: nextHash,
      }
      saveOwnerProfile(next)
      refreshProfile()
      setOldPw1('')
      setOldPw2('')
      setNewPw('')
      setOk(true)
      window.setTimeout(() => setOk(false), 3000)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="ra-owner-profile" aria-labelledby="owner-profile-h">
      <header className="ra-owner-profile__head">
        <span className="ra-owner-profile__ico" aria-hidden>
          👤
        </span>
        <div>
          <h1 id="owner-profile-h" className="ra-owner-profile__title">
            {t('owner.profilePage.title')}
          </h1>
          <p className="ra-owner-profile__lead">{t('owner.profilePage.lead')}</p>
        </div>
      </header>

      <form className="ra-owner-profile__form" onSubmit={onSubmit}>
        <label className="ra-fld">
          <span>{t('owner.profilePage.nameLabel')}</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
          />
        </label>

        <label className="ra-fld">
          <span>{t('owner.profilePage.emailLabel')}</span>
          <div className="ra-fld__locked-wrap">
            <input value={profile.email} readOnly className="ra-fld__locked" tabIndex={-1} />
            <LockMailIcon />
          </div>
        </label>

        <label className="ra-fld">
          <span>{t('owner.profilePage.phoneLabel')}</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            inputMode="tel"
          />
        </label>

        <div className="ra-fld">
          <span>{t('owner.profilePage.avatarLabel')}</span>
          <div className="ra-owner-profile__avatar-row">
            {avatarDataUrl ? (
              <img src={avatarDataUrl} alt="" className="ra-owner-profile__avatar-preview" width={72} height={72} />
            ) : (
              <div className="ra-owner-profile__avatar-ph" aria-hidden />
            )}
            <div className="ra-owner-profile__avatar-actions">
              <button type="button" className="ra-btn ra-btn--ghost" onClick={onPickFile}>
                {t('owner.profilePage.pickImage')}
              </button>
              {avatarDataUrl ? (
                <button
                  type="button"
                  className="ra-btn ra-btn--ghost"
                  onClick={() => {
                    setAvatarDataUrl(null)
                  }}
                >
                  {t('owner.profilePage.removeImage')}
                </button>
              ) : null}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="ra-owner-profile__file"
              onChange={(e) => void onFile(e.target.files)}
            />
          </div>
        </div>

        <fieldset className="ra-owner-profile__pw">
          <legend>{t('owner.profilePage.passwordLegend')}</legend>
          <p className="ra-owner-profile__pw-hint">{t('owner.profilePage.passwordHint')}</p>

          <label className="ra-fld">
            <span>{t('owner.profilePage.oldPassword1')}</span>
            <div className="ra-fld__pw-row">
              <input
                type={showOld1 ? 'text' : 'password'}
                value={oldPw1}
                onChange={(e) => setOldPw1(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="ra-fld__pw-toggle"
                onClick={() => setShowOld1((v) => !v)}
                aria-label={t('owner.profilePage.togglePassword')}
              >
                <EyeIcon open={showOld1} />
              </button>
            </div>
          </label>

          <label className="ra-fld">
            <span>{t('owner.profilePage.oldPassword2')}</span>
            <div className="ra-fld__pw-row">
              <input
                type={showOld2 ? 'text' : 'password'}
                value={oldPw2}
                onChange={(e) => setOldPw2(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="ra-fld__pw-toggle"
                onClick={() => setShowOld2((v) => !v)}
                aria-label={t('owner.profilePage.togglePassword')}
              >
                <EyeIcon open={showOld2} />
              </button>
            </div>
          </label>

          <label className="ra-fld">
            <span>{t('owner.profilePage.newPassword')}</span>
            <div className="ra-fld__pw-row">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="ra-fld__pw-toggle"
                onClick={() => setShowNew((v) => !v)}
                aria-label={t('owner.profilePage.togglePassword')}
              >
                <EyeIcon open={showNew} />
              </button>
            </div>
          </label>
        </fieldset>

        {err ? <p className="ra-owner-profile__err">{err}</p> : null}
        {ok ? <p className="ra-owner-profile__ok">{t('owner.profilePage.saved')}</p> : null}

        <button type="submit" className="ra-btn ra-btn--primary ra-owner-profile__submit" disabled={busy}>
          {t('owner.profilePage.save')}
        </button>
      </form>
    </section>
  )
}
