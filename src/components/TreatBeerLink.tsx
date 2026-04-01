import { useTranslation } from 'react-i18next'

const PAYPAL_ME = 'https://paypal.me/RentAdriacom'

type TreatBeerLinkProps = {
  /** `header` — pored prijave; `footer` — uz kartice */
  variant?: 'header' | 'footer'
}

export function TreatBeerLink({ variant = 'header' }: TreatBeerLinkProps) {
  const { t } = useTranslation()
  return (
    <a
      href={PAYPAL_ME}
      target="_blank"
      rel="noopener noreferrer"
      className={`ra-treat-beer ${variant === 'footer' ? 'ra-treat-beer--footer' : ''}`}
      aria-label={`${t('nav.treatBeer')} (PayPal)`}
    >
      <span className="ra-treat-beer__ico" aria-hidden>
        🍺
      </span>
      <span className="ra-treat-beer__label">{t('nav.treatBeer')}</span>
    </a>
  )
}
