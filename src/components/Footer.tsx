import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Logo } from './Logo'
import { AmexMark, MastercardMark, VisaMark } from './icons/PaymentBrandIcons'

export function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="ra-footer">
      <div className="ra-footer__shell">
        <div className="ra-footer__inner">
          <Logo variant="footer" />
          <nav className="ra-footer__links" aria-label="Legal">
            <Link to="/terms">{t('footer.terms')}</Link>
            <Link to="/privacy">{t('footer.privacy')}</Link>
            <Link to="/faq">{t('footer.faq')}</Link>
            <Link to="/pricing">{t('footer.pricing')}</Link>
          </nav>
        </div>

        <p className="ra-footer__rate">{t('footer.rateDisclaimer')}</p>

        <div className="ra-footer__bar">
          <div className="ra-footer__bar-spacer" aria-hidden />
          <p className="ra-footer__copy">{t('footer.copyrightLine')}</p>
          <div className="ra-footer__payments">
            <span className="ra-footer__card-ico" title="Visa">
              <VisaMark />
            </span>
            <span className="ra-footer__card-ico" title="Mastercard">
              <MastercardMark />
            </span>
            <span className="ra-footer__card-ico" title="American Express">
              <AmexMark />
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
