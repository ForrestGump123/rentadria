import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { LegalShell } from '../components/LegalShell'
import { getTermsSections } from '../content/legal/resolve'

export function TermsPage() {
  const { t, i18n } = useTranslation()
  const sections = useMemo(() => getTermsSections(i18n.language), [i18n.language])

  return (
    <LegalShell title={t('legal.termsTitle')}>
      <article className="ra-legal-prose">
        {sections.map((s, i) => (
          <section key={i} className="ra-legal-section">
            <h2>{s.title}</h2>
            <p>{s.body}</p>
          </section>
        ))}
      </article>
    </LegalShell>
  )
}
