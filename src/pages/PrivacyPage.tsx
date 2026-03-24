import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { LegalShell } from '../components/LegalShell'
import { getPrivacySections } from '../content/legal/resolve'

export function PrivacyPage() {
  const { t, i18n } = useTranslation()
  const sections = useMemo(() => getPrivacySections(i18n.language), [i18n.language])

  return (
    <LegalShell title={t('legal.privacyTitle')}>
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
