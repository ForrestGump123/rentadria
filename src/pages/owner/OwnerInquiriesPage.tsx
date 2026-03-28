import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { formatDateDots } from '../../utils/ownerSession'
import {
  clearInquiryUnread,
  getInquiriesForOwner,
  type VisitorInquiryRecord,
} from '../../utils/visitorInquiries'

type Props = {
  ownerUserId: string
}

export function OwnerInquiriesPage({ ownerUserId }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [epoch, setEpoch] = useState(0)

  useEffect(() => {
    clearInquiryUnread(ownerUserId)
  }, [ownerUserId])

  useEffect(() => {
    const bump = () => setEpoch((e) => e + 1)
    window.addEventListener('rentadria-inquiries-updated', bump)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'rentadria_inquiries_by_owner_v1') bump()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('rentadria-inquiries-updated', bump)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const rows = useMemo(
    () => getInquiriesForOwner(ownerUserId),
    [ownerUserId, epoch],
  )

  return (
    <section className="ra-owner-inquiries" aria-labelledby="owner-inquiries-h">
      <div className="ra-owner-inquiries__head">
        <span className="ra-owner-inquiries__ico" aria-hidden>
          ✉️
        </span>
        <div>
          <h2 id="owner-inquiries-h" className="ra-owner-inquiries__title">
            {t('owner.inquiriesPage.title')}
          </h2>
          <p className="ra-owner-inquiries__lead">{t('owner.inquiriesPage.lead')}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="ra-owner-inquiries__empty">{t('owner.inquiriesPage.empty')}</p>
      ) : (
        <div className="ra-owner-table-wrap ra-owner-table-wrap--inquiries">
          <table className="ra-owner-table ra-owner-table--inquiries">
            <thead>
              <tr>
                <th>{t('owner.inquiriesPage.colDate')}</th>
                <th>{t('owner.inquiriesPage.colListing')}</th>
                <th>{t('owner.inquiriesPage.colGuest')}</th>
                <th>{t('owner.inquiriesPage.colEmail')}</th>
                <th>{t('owner.inquiriesPage.colPhone')}</th>
                <th>{t('owner.inquiriesPage.colPeriod')}</th>
                <th>{t('owner.inquiriesPage.colGuests')}</th>
                <th>{t('owner.inquiriesPage.colMessage')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: VisitorInquiryRecord) => (
                <tr key={r.id}>
                  <td>{formatDateDots(r.at)}</td>
                  <td>
                    <button
                      type="button"
                      className="ra-owner-inquiries__listing-link"
                      onClick={() => navigate(`/listing/${encodeURIComponent(r.listingId)}`)}
                    >
                      {r.listingTitle}
                    </button>
                  </td>
                  <td>
                    {r.first} {r.last}
                  </td>
                  <td>
                    <a href={`mailto:${r.email}`}>{r.email}</a>
                  </td>
                  <td>{r.phone}</td>
                  <td>{r.period}</td>
                  <td>{r.guests}</td>
                  <td className="ra-owner-table__msg">{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
