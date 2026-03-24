import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Logo } from '../Logo'
import { openMailto } from '../../utils/mailto'
import { saveReport } from '../../utils/storage'

type ReportModalProps = {
  open: boolean
  onClose: () => void
  listingTitle: string
  listingId: string
}

export function ReportModal({ open, onClose, listingTitle, listingId }: ReportModalProps) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [email, setEmail] = useState('')

  if (!open) return null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const body = [
      `Listing: ${listingTitle} (${listingId})`,
      `Reason: ${reason}`,
      `Name: ${first} ${last}`,
      `Email: ${email}`,
    ].join('\n')
    saveReport({ listingId, reason, first, last, email })
    openMailto('info@rentadria.com', `Report listing: ${listingTitle}`, body)
    onClose()
  }

  return (
    <div className="ra-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <form className="ra-modal__panel ra-report" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <button type="button" className="ra-modal__close" onClick={onClose}>
          ×
        </button>
        <div className="ra-modal__brand">
          <Logo variant="modalCompact" />
        </div>
        <h2>{t('detail.report.title')}</h2>
        <p className="ra-report__hint">{t('detail.report.hint')}</p>
        <label className="ra-fld">
          <span>{t('detail.report.reason')} *</span>
          <textarea required rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('detail.report.phReason')} />
        </label>
        <label className="ra-fld">
          <span>{t('detail.report.first')} *</span>
          <input required value={first} onChange={(e) => setFirst(e.target.value)} placeholder={t('detail.report.phFirst')} />
        </label>
        <label className="ra-fld">
          <span>{t('detail.report.last')} *</span>
          <input required value={last} onChange={(e) => setLast(e.target.value)} placeholder={t('detail.report.phLast')} />
        </label>
        <label className="ra-fld">
          <span>{t('detail.report.email')} *</span>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('detail.report.phEmail')} />
        </label>
        <div className="ra-report__actions">
          <button type="button" className="ra-btn ra-btn--ghost" onClick={onClose}>
            {t('detail.report.cancel')}
          </button>
          <button type="submit" className="ra-btn ra-btn--danger">
            {t('detail.report.submit')}
          </button>
        </div>
      </form>
    </div>
  )
}
