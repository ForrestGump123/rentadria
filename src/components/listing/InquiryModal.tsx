import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Logo } from '../Logo'
import { sendOwnerInquiryEmail } from '../../lib/sendOwnerInquiryEmail'
import { openMailto } from '../../utils/mailto'
import { getInquiryNotificationPrefs } from '../../utils/inquiryNotificationPrefs'
import {
  appendVisitorInquiry,
  bumpInquiryUnread,
  dispatchInquiriesUpdated,
  getListingInquiryNotifyEmail,
  resolveOwnerUserIdForListing,
} from '../../utils/visitorInquiries'

type InquiryModalProps = {
  open: boolean
  onClose: () => void
  listingTitle: string
  listingId: string
}

export function InquiryModal({ open, onClose, listingTitle, listingId }: InquiryModalProps) {
  const { t } = useTranslation()
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('+382 ')
  const [period, setPeriod] = useState('')
  const [guests, setGuests] = useState('')
  const [message, setMessage] = useState('')
  const [terms, setTerms] = useState(false)

  if (!open) return null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!terms) return
    const body = [
      `Listing: ${listingTitle} (${listingId})`,
      `Name: ${first} ${last}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      `Period: ${period}`,
      `Guests: ${guests}`,
      '',
      message,
    ].join('\n')
    const ownerUserId = resolveOwnerUserIdForListing(listingId)
    const notifyTo = getListingInquiryNotifyEmail(listingId) ?? 'info@rentadria.com'

    void (async () => {
      if (ownerUserId) {
        appendVisitorInquiry(ownerUserId, {
          listingId,
          listingTitle,
          first,
          last,
          email,
          phone,
          period,
          guests,
          message,
        })
        const prefs = getInquiryNotificationPrefs(ownerUserId)
        const shouldEmail = prefs.receiveEnabled && prefs.emailChannel
        const shouldDashboard = prefs.receiveEnabled && prefs.dashboardChannel

        if (shouldEmail) {
          try {
            await sendOwnerInquiryEmail({
              toEmail: notifyTo,
              listingTitle,
              listingId,
              guestFirst: first,
              guestLast: last,
              guestEmail: email,
              guestPhone: phone,
              period,
              guests,
              message,
            })
          } catch {
            openMailto(notifyTo, `Inquiry: ${listingTitle}`, body)
          }
        }
        if (shouldDashboard) {
          bumpInquiryUnread(ownerUserId)
        }
      } else {
        openMailto(notifyTo, `Inquiry: ${listingTitle}`, body)
      }
      dispatchInquiriesUpdated()
      onClose()
    })()
  }

  return (
    <div className="ra-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <form className="ra-modal__panel ra-inquiry" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <button type="button" className="ra-modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="ra-modal__brand">
          <Logo variant="modalCompact" />
        </div>
        <h2>{t('detail.inquiry.title')}</h2>
        <label className="ra-fld">
          <span>{t('detail.inquiry.first')} *</span>
          <input required value={first} onChange={(e) => setFirst(e.target.value)} placeholder={t('detail.inquiry.phFirst')} />
        </label>
        <label className="ra-fld">
          <span>{t('detail.inquiry.last')} *</span>
          <input required value={last} onChange={(e) => setLast(e.target.value)} placeholder={t('detail.inquiry.phLast')} />
        </label>
        <label className="ra-fld">
          <span>{t('detail.inquiry.email')} *</span>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('detail.inquiry.phEmail')} />
        </label>
        <label className="ra-fld">
          <span>{t('detail.inquiry.phone')} *</span>
          <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('detail.inquiry.phPhone')} />
        </label>
        <label className="ra-fld">
          <span>{t('detail.inquiry.period')} *</span>
          <input required value={period} onChange={(e) => setPeriod(e.target.value)} placeholder={t('detail.inquiry.phPeriod')} />
        </label>
        <label className="ra-fld">
          <span>{t('detail.inquiry.guests')} *</span>
          <input required value={guests} onChange={(e) => setGuests(e.target.value)} placeholder={t('detail.inquiry.phGuests')} />
        </label>
        <label className="ra-fld">
          <span>{t('detail.inquiry.message')} *</span>
          <textarea required rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('detail.inquiry.phMessage')} />
        </label>
        <label className="ra-check">
          <input type="checkbox" required checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          <span>{t('detail.inquiry.terms')}</span>
        </label>
        <button type="submit" className="ra-btn ra-btn--inquiry">
          {t('detail.inquiry.submit')}
        </button>
      </form>
    </div>
  )
}
