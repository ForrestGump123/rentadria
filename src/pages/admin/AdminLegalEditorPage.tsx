import { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import type { FaqItem, LegalSection } from '../../content/legal/types'
import {
  getBuiltInFaq,
  getBuiltInPrivacy,
  getBuiltInTerms,
} from '../../content/legal/resolve'
import { LANGUAGES, type LanguageCode } from '../../languages'
import { isAdminSession } from '../../utils/adminSession'
import {
  loadFaqOverride,
  loadPrivacyOverride,
  loadTermsOverride,
  pullLegalOverride,
  resetLegalOverride,
  saveLegalOverride,
  type LegalKind,
} from '../../utils/legalOverrides'

type Page = 'terms' | 'privacy' | 'faq'
type LegalLocaleKey = 'cnr' | 'en' | 'sq' | 'it' | 'es'

function languageCodeToLegalLocale(code: LanguageCode): LegalLocaleKey {
  if (code === 'en') return 'en'
  if (code === 'sq') return 'sq'
  if (code === 'it') return 'it'
  if (code === 'es') return 'es'
  return 'cnr'
}

function initialUiLang(i18nLanguage: string): LanguageCode {
  const base = (i18nLanguage || 'en').split('-')[0]?.toLowerCase() ?? 'en'
  const hit = LANGUAGES.find((l) => l.code === base)
  return (hit?.code ?? 'en') as LanguageCode
}

export function AdminLegalEditorPage() {
  const { page } = useParams<{ page: string }>()
  const { t, i18n } = useTranslation()
  const kind: Page = page === 'privacy' || page === 'faq' ? page : 'terms'
  const [uiLang, setUiLang] = useState<LanguageCode>(() => initialUiLang(i18n.language))
  const locale = useMemo(() => languageCodeToLegalLocale(uiLang), [uiLang])

  const [termsSections, setTermsSections] = useState<LegalSection[]>([])
  const [privacySections, setPrivacySections] = useState<LegalSection[]>([])
  const [faqItems, setFaqItems] = useState<FaqItem[]>([])
  const [err, setErr] = useState('')
  const [loadError, setLoadError] = useState(false)

  const titleKey =
    kind === 'terms' ? 'admin.nav.terms' : kind === 'privacy' ? 'admin.nav.privacy' : 'admin.nav.faq'

  const loadDefault = useCallback(() => {
    if (kind === 'terms') {
      const o = loadTermsOverride(locale)
      setTermsSections(o ?? getBuiltInTerms(locale))
    } else if (kind === 'privacy') {
      const o = loadPrivacyOverride(locale)
      setPrivacySections(o ?? getBuiltInPrivacy(locale))
    } else {
      const o = loadFaqOverride(locale)
      const arr = o ?? getBuiltInFaq(locale)
      setFaqItems(arr.map((x, i) => ({ ...x, id: x.id || String(i + 1) })))
    }
    setErr('')
  }, [kind, locale])

  useEffect(() => {
    loadDefault()
  }, [loadDefault])

  useEffect(() => {
    void pullLegalOverride(locale, kind as LegalKind).then((r) => {
      setLoadError(r === null)
      loadDefault()
    })
  }, [locale, kind, loadDefault])

  const onSave = () => {
    void (async () => {
      try {
        let content: unknown[] = []
        if (kind === 'faq') {
          content = faqItems.map((x, i) => ({
            id: String(x.id || i + 1),
            question: x.question.trim(),
            answer: x.answer.trim(),
          }))
        } else if (kind === 'privacy') {
          content = privacySections.map((s) => ({ title: s.title.trim(), body: s.body.trim() }))
        } else {
          content = termsSections.map((s) => ({ title: s.title.trim(), body: s.body.trim() }))
        }
        const ok = await saveLegalOverride(locale, kind as LegalKind, content)
        if (!ok) {
          setErr(t('admin.legalEditor.errSave'))
          return
        }
        setErr('')
        window.alert(t('admin.legalEditor.saved'))
      } catch {
        setErr(t('admin.legalEditor.errSave'))
      }
    })()
  }

  const onReset = () => {
    if (!window.confirm(t('admin.legalEditor.confirmReset'))) return
    void (async () => {
      const ok = await resetLegalOverride(locale, kind as LegalKind)
      if (!ok) {
        setErr(t('admin.legalEditor.errReset'))
        return
      }
      setErr('')
      await pullLegalOverride(locale, kind as LegalKind)
      loadDefault()
    })()
  }

  const summaryLine = (title: string, fallbackKey: string) =>
    title.trim() || t(fallbackKey)

  if (!isAdminSession()) return null

  const showBalkanHint = locale === 'cnr' && ['sr', 'hr', 'bs'].includes(uiLang)

  return (
    <div className="ra-admin-legal">
      <Helmet>
        <title>{t(titleKey)} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <header className="ra-admin-head">
        <h1 className="ra-admin-title">{t(titleKey)}</h1>
        <p className="ra-admin-subtitle">{t('admin.legalEditor.leadSimple')}</p>
        {loadError ? <p className="ra-admin-listings__hint">{t('admin.legalEditor.loadError')}</p> : null}
      </header>

      <div className="ra-admin-toolbar ra-admin-toolbar--legal">
        <label className="ra-fld ra-admin-legal__lang-field">
          <span>{t('admin.legalEditor.locale')}</span>
          <select
            className="ra-admin-legal__lang-select"
            value={uiLang}
            onChange={(e) => setUiLang(e.target.value as LanguageCode)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.short} — {l.name}
              </option>
            ))}
          </select>
        </label>
        {showBalkanHint && (
          <p className="ra-admin-legal__locale-hint">{t('admin.legalEditor.sharedBalkanPack')}</p>
        )}
        <button type="button" className="ra-btn" onClick={loadDefault}>
          {t('admin.legalEditor.reload')}
        </button>
        <button type="button" className="ra-btn" onClick={onReset}>
          {t('admin.legalEditor.resetDefaults')}
        </button>
      </div>

      {kind === 'terms' && (
        <div className="ra-admin-legal-simple">
          {termsSections.map((s, i) => (
            <details key={i} className="ra-admin-legal-simple__details">
              <summary className="ra-admin-legal-simple__summary">
                <span className="ra-admin-legal-simple__summary-text">
                  {summaryLine(s.title, 'admin.legalEditor.untitledSection')}
                </span>
              </summary>
              <div className="ra-admin-legal-simple__details-body">
                <label className="ra-fld">
                  <span>{t('admin.legalEditor.sectionTitle')}</span>
                  <input
                    className="ra-admin-legal__input"
                    value={s.title}
                    onChange={(e) => {
                      const next = [...termsSections]
                      next[i] = { ...next[i], title: e.target.value }
                      setTermsSections(next)
                    }}
                  />
                </label>
                <label className="ra-fld">
                  <span>{t('admin.legalEditor.sectionBody')}</span>
                  <textarea
                    className="ra-admin-legal__textarea"
                    rows={8}
                    value={s.body}
                    onChange={(e) => {
                      const next = [...termsSections]
                      next[i] = { ...next[i], body: e.target.value }
                      setTermsSections(next)
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="ra-btn ra-btn--sm ra-admin-legal-simple__remove"
                  onClick={() => setTermsSections(termsSections.filter((_, j) => j !== i))}
                >
                  {t('admin.legalEditor.removeSection')}
                </button>
              </div>
            </details>
          ))}
          <button
            type="button"
            className="ra-btn ra-btn--primary"
            onClick={() => setTermsSections([...termsSections, { title: '', body: '' }])}
          >
            {t('admin.legalEditor.addSection')}
          </button>
        </div>
      )}

      {kind === 'privacy' && (
        <div className="ra-admin-legal-simple">
          {privacySections.map((s, i) => (
            <details key={i} className="ra-admin-legal-simple__details">
              <summary className="ra-admin-legal-simple__summary">
                <span className="ra-admin-legal-simple__summary-text">
                  {summaryLine(s.title, 'admin.legalEditor.untitledSection')}
                </span>
              </summary>
              <div className="ra-admin-legal-simple__details-body">
                <label className="ra-fld">
                  <span>{t('admin.legalEditor.sectionTitle')}</span>
                  <input
                    className="ra-admin-legal__input"
                    value={s.title}
                    onChange={(e) => {
                      const next = [...privacySections]
                      next[i] = { ...next[i], title: e.target.value }
                      setPrivacySections(next)
                    }}
                  />
                </label>
                <label className="ra-fld">
                  <span>{t('admin.legalEditor.sectionBody')}</span>
                  <textarea
                    className="ra-admin-legal__textarea"
                    rows={8}
                    value={s.body}
                    onChange={(e) => {
                      const next = [...privacySections]
                      next[i] = { ...next[i], body: e.target.value }
                      setPrivacySections(next)
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="ra-btn ra-btn--sm ra-admin-legal-simple__remove"
                  onClick={() => setPrivacySections(privacySections.filter((_, j) => j !== i))}
                >
                  {t('admin.legalEditor.removeSection')}
                </button>
              </div>
            </details>
          ))}
          <button
            type="button"
            className="ra-btn ra-btn--primary"
            onClick={() => setPrivacySections([...privacySections, { title: '', body: '' }])}
          >
            {t('admin.legalEditor.addSection')}
          </button>
        </div>
      )}

      {kind === 'faq' && (
        <div className="ra-admin-legal-simple">
          {faqItems.map((item, i) => (
            <details key={item.id + String(i)} className="ra-admin-legal-simple__details">
              <summary className="ra-admin-legal-simple__summary">
                <span className="ra-admin-legal-simple__summary-text">
                  {summaryLine(item.question, 'admin.legalEditor.untitledFaq')}
                </span>
              </summary>
              <div className="ra-admin-legal-simple__details-body">
                <label className="ra-fld">
                  <span>{t('admin.legalEditor.faqQuestion')}</span>
                  <input
                    className="ra-admin-legal__input"
                    value={item.question}
                    onChange={(e) => {
                      const next = [...faqItems]
                      next[i] = { ...next[i], question: e.target.value }
                      setFaqItems(next)
                    }}
                  />
                </label>
                <label className="ra-fld">
                  <span>{t('admin.legalEditor.faqAnswer')}</span>
                  <textarea
                    className="ra-admin-legal__textarea"
                    rows={8}
                    value={item.answer}
                    onChange={(e) => {
                      const next = [...faqItems]
                      next[i] = { ...next[i], answer: e.target.value }
                      setFaqItems(next)
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="ra-btn ra-btn--sm ra-admin-legal-simple__remove"
                  onClick={() => setFaqItems(faqItems.filter((_, j) => j !== i))}
                >
                  {t('admin.legalEditor.removeFaq')}
                </button>
              </div>
            </details>
          ))}
          <button
            type="button"
            className="ra-btn ra-btn--primary"
            onClick={() =>
              setFaqItems([
                ...faqItems,
                { id: String(faqItems.length + 1), question: '', answer: '' },
              ])
            }
          >
            {t('admin.legalEditor.addFaq')}
          </button>
        </div>
      )}

      {err && <p className="ra-admin-gate__err">{err}</p>}
      <button type="button" className="ra-btn ra-btn--primary ra-admin-legal-simple__save" onClick={onSave}>
        {t('admin.legalEditor.save')}
      </button>
    </div>
  )
}
