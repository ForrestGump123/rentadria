import { useTranslation } from 'react-i18next'

type Props = {
  titleKey: string
}

export function OwnerSubPlaceholder({ titleKey }: Props) {
  const { t } = useTranslation()
  return (
    <section className="ra-owner-sub" aria-labelledby="owner-sub-h">
      <h2 id="owner-sub-h" className="ra-owner-stats__title">
        {t(titleKey)}
      </h2>
      <p className="ra-owner-lead">{t('owner.subPlaceholder')}</p>
    </section>
  )
}
