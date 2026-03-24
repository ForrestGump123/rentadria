import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { LegalShell } from '../components/LegalShell'
import { getFaqItems } from '../content/legal/resolve'

export function FaqPage() {
  const { t, i18n } = useTranslation()
  const items = useMemo(() => getFaqItems(i18n.language), [i18n.language])

  return (
    <LegalShell title={t('legal.faqTitle')}>
      <div className="ra-faq">
        {items.map((item) => (
          <details key={item.id} className="ra-faq__item">
            <summary className="ra-faq__summary">{item.question}</summary>
            <div className="ra-faq__answer">
              <p>{item.answer}</p>
            </div>
          </details>
        ))}
      </div>
    </LegalShell>
  )
}
