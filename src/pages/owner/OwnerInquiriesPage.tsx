import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { listingPublicNumberFromId } from '../../data/listingDetail'
import { formatDateDots } from '../../utils/ownerSession'
import { telHrefFromPhone } from '../../utils/phoneLink'
import type { VisitorInquiryRecord } from '../../utils/visitorInquiries'

type Props = {
  ownerUserId: string
}

export function OwnerInquiriesPage({ ownerUserId }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [epoch, setEpoch] = useState(0)
  const [rowsServer, setRowsServer] = useState<VisitorInquiryRecord[]>([])
  const inflight = useRef(false)

  useEffect(() => {
    void fetch('/api/owner-inquiries', { method: 'POST', credentials: 'include' }).catch(() => {})
  }, [ownerUserId])

  const pull = useCallback(async () => {
    if (inflight.current) return
    inflight.current = true
    try {
      const r = await fetch('/api/owner-inquiries', { credentials: 'include' })
      const j = (await r.json()) as { ok?: boolean; inquiries?: VisitorInquiryRecord[] }
      if (r.ok && j.ok && Array.isArray(j.inquiries)) {
        setRowsServer(j.inquiries)
        setEpoch((e) => e + 1)
      }
    } catch {
      /* ignore */
    } finally {
      inflight.current = false
    }
  }, [])

  useEffect(() => {
    void pull()
  }, [ownerUserId, pull])

  useEffect(() => {
    let timer: number | null = null

    const schedule = () => {
      if (timer != null) return
      timer = window.setInterval(() => {
        if (document.visibilityState !== 'visible') return
        void pull()
      }, 30_000)
    }

    const stop = () => {
      if (timer != null) window.clearInterval(timer)
      timer = null
    }

    const onVis = () => {
      if (document.visibilityState === 'visible') {
        schedule()
        void pull()
      } else {
        stop()
      }
    }

    onVis()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      stop()
    }
  }, [pull])

  const rows = useMemo(() => {
    void epoch
    return rowsServer
  }, [epoch, rowsServer])

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
              {rows.map((r: VisitorInquiryRecord) => {
                const phoneHref = telHrefFromPhone(r.phone)
                return (
                  <tr key={r.id}>
                    <td>{formatDateDots(r.at)}</td>
                    <td className="ra-owner-table__mono">{listingPublicNumberFromId(r.listingId)}</td>
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
                    <td>
                      {phoneHref ? (
                        <a href={phoneHref} className="ra-owner-inquiries__phone-link">
                          {r.phone}
                        </a>
                      ) : (
                        r.phone || '—'
                      )}
                    </td>
                    <td>{r.period}</td>
                    <td>{r.guests}</td>
                    <td className="ra-owner-table__msg">{r.message}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
