import { useCallback, useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import type { FaqItem, LegalSection } from '../../content/legal/types'
import {
  getBuiltInFaq,
  getBuiltInPrivacy,
  getBuiltInTerms,
  resolveLegalContentKey,
} from '../../content/legal/resolve'
import { isAdminSession } from '../../utils/adminSession'
import {
  loadFaqOverride,
  loadPrivacyOverride,
  loadTermsOverride,
  saveFaqOverride,
  savePrivacyOverride,
  saveTermsOverride,
} from '../../utils/legalOverrides'

type Page = 'terms' | 'privacy' | 'faq'

const LOCALES: { id: 'cnr' | 'en' | 'sq' | 'it' | 'es'; label: string }[] = [
  { id: 'cnr', label: 'CNR' },
  { id: 'en', label: 'EN' },
  { id: 'sq', label: 'SQ' },
  { id: 'it', label: 'IT' },
  { id: 'es', label: 'ES' },
]

export function AdminLegalEditorPage() {
  const { page } = useParams<{ page: string }>()
  const { t, i18n } = useTranslation()
  const kind: Page = page === 'privacy' || page === 'faq' ? page : 'terms'
  const [locale, setLocale] = useState<'cnr' | 'en' | 'sq' | 'it' | 'es'>(() => resolveLegalContentKey(i18n.language))
  const [json, setJson] = useState('')
  const [err, setErr] = useState('')

  const titleKey =
    kind === 'terms' ? 'admin.nav.terms' : kind === 'privacy' ? 'admin.nav.privacy' : 'admin.nav.faq'

  const loadDefault = useCallback(() => {
    if (kind === 'terms') {
      const o = loadTermsOverride(locale)
      setJson(JSON.stringify(o ?? getBuiltInTerms(locale), null, 2))
    } else if (kind === 'privacy') {
      const o = loadPrivacyOverride(locale)
      setJson(JSON.stringify(o ?? getBuiltInPrivacy(locale), null, 2))
    } else {
      const o = loadFaqOverride(locale)
      setJson(JSON.stringify(o ?? getBuiltInFaq(locale), null, 2))
    }
    setErr('')
  }, [kind, locale])

  useEffect(() => {
    loadDefault()
  }, [loadDefault])

  const onSave = () => {
    try {
      const parsed = JSON.parse(json) as unknown
      if (!Array.isArray(parsed)) throw new Error('not_array')
      if (kind === 'faq') {
        saveFaqOverride(locale, parsed as FaqItem[])
      } else if (kind === 'privacy') {
        savePrivacyOverride(locale, parsed as LegalSection[])
      } else {
        saveTermsOverride(locale, parsed as LegalSection[])
      }
      setErr('')
      window.alert(t('admin.legalEditor.saved'))
    } catch {
      setErr(t('admin.legalEditor.errJson'))
    }
  }

  if (!isAdminSession()) return null

  return (
    <div className="ra-admin-legal">
      <Helmet>
        <title>{t(titleKey)} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <header className="ra-admin-head">
        <h1 className="ra-admin-title">{t(titleKey)}</h1>
        <p className="ra-admin-subtitle">{t('admin.legalEditor.lead')}</p>
      </header>

      <div className="ra-admin-toolbar">
        <label className="ra-fld">
          <span>{t('admin.legalEditor.locale')}</span>
          <select value={locale} onChange={(e) => setLocale(e.target.value as typeof locale)}>
            {LOCALES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="ra-btn" onClick={loadDefault}>
          {t('admin.legalEditor.reload')}
        </button>
      </div>

      <label className="ra-fld">
        <span>{t('admin.legalEditor.json')}</span>
        <textarea className="ra-admin-legal__textarea" rows={22} value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} />
      </label>
      {err && <p className="ra-admin-gate__err">{err}</p>}
      <button type="button" className="ra-btn ra-btn--primary" onClick={onSave}>
        {t('admin.legalEditor.save')}
      </button>
    </div>
  )
}
