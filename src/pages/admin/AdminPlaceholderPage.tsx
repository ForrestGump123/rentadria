import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'

type Props = {
  /** npr. admin.nav.listings */
  titleKey: string
}

export function AdminPlaceholderPage({ titleKey }: Props) {
  const { t } = useTranslation()
  return (
    <div className="ra-admin-placeholder">
      <Helmet>
        <title>{t(titleKey)} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <header className="ra-admin-head">
        <h1 className="ra-admin-title">{t(titleKey)}</h1>
        <p className="ra-admin-subtitle">{t('admin.placeholderSubtitle')}</p>
      </header>
    </div>
  )
}
