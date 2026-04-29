import { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getListingById } from '../../data/listings'
import type { ListingCategory } from '../../types'
import { isAdminSession } from '../../utils/adminSession'
import { formatDateDots, getOwnerProfileByUserId } from '../../utils/ownerSession'
import { clearAdminVisitorInquiryUnread, type VisitorInquiryRecord } from '../../utils/visitorInquiries'

type Row = VisitorInquiryRecord & { ownerUserId: string }

export function AdminInquiriesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [epoch, setEpoch] = useState(0)
  const [open, setOpen] = useState<Row | null>(null)
  const [editMsg, setEditMsg] = useState('')
  const [editReply, setEditReply] = useState('')
  const [rowsServer, setRowsServer] = useState<Row[]>([])

  const bump = useCallback(() => setEpoch((e) => e + 1), [])

  useEffect(() => {
    clearAdminVisitorInquiryUnread()
    bump()
  }, [bump])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch('/api/admin-inquiries', { credentials: 'include' })
        const j = (await r.json()) as { ok?: boolean; inquiries?: (VisitorInquiryRecord & { ownerUserId: string })[] }
        if (!cancelled && r.ok && j.ok && Array.isArray(j.inquiries)) {
          setRowsServer(j.inquiries as Row[])
          bump()
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bump])

  const rows = useMemo(() => {
    void epoch
    return rowsServer
  }, [epoch, rowsServer])

  const openRow = (r: Row) => {
    setOpen(r)
    setEditMsg(r.message)
    setEditReply(r.ownerReply ?? '')
  }

  const saveEdit = () => {
    if (!open) return
    void (async () => {
      await fetch('/api/admin-inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ownerUserId: open.ownerUserId,
          id: open.id,
          patch: { message: editMsg, ownerReply: editReply },
        }),
      }).catch(() => {})
      setOpen(null)
      const r = await fetch('/api/admin-inquiries', { credentials: 'include' })
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; inquiries?: (VisitorInquiryRecord & { ownerUserId: string })[] }
      if (r.ok && j.ok && Array.isArray(j.inquiries)) {
        setRowsServer(j.inquiries as Row[])
      }
      bump()
    })()
  }

  const catLabel = (listingId: string): string => {
    const l = getListingById(listingId)
    if (!l) return '—'
    const c = l.category as ListingCategory
    return t(`nav.${c}`)
  }

  if (!isAdminSession()) return null

  return (
    <div className="ra-admin-inquiries">
      <Helmet>
        <title>{t('admin.inquiries.pageTitle')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <header className="ra-admin-head">
        <h1 className="ra-admin-title">{t('admin.inquiries.heading')}</h1>
        <p className="ra-admin-subtitle">{t('admin.inquiries.lead')}</p>
      </header>

      <div className="ra-admin-listings__table-wrap">
        <table className="ra-admin-listings__table">
          <thead>
            <tr>
              <th>{t('admin.inquiries.colDate')}</th>
              <th>{t('admin.inquiries.colListing')}</th>
              <th>{t('admin.inquiries.colCategory')}</th>
              <th>{t('admin.inquiries.colFrom')}</th>
              <th>{t('admin.inquiries.colTo')}</th>
              <th>{t('admin.inquiries.colPreview')}</th>
              <th>{t('admin.inquiries.colPaused')}</th>
              <th>{t('admin.inquiries.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="ra-admin-listings__empty">
                  {t('admin.inquiries.empty')}
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const owner = getOwnerProfileByUserId(r.ownerUserId)
                return (
                  <tr key={`${r.ownerUserId}-${r.id}`}>
                    <td>{formatDateDots(r.at)}</td>
                    <td className="ra-admin-listings__mono">{r.listingTitle}</td>
                    <td>{catLabel(r.listingId)}</td>
                    <td>
                      {r.first} {r.last}
                      <br />
                      <span className="ra-admin-listings__hint">{r.email}</span>
                    </td>
                    <td>{owner?.email ?? r.ownerUserId}</td>
                    <td className="ra-admin-inquiries__preview">{r.message.slice(0, 80)}{r.message.length > 80 ? '…' : ''}</td>
                    <td>{r.paused ? t('admin.inquiries.yes') : '—'}</td>
                    <td className="ra-admin-listings__actions ra-admin-owners__actions-row">
                      <button type="button" className="ra-btn ra-btn--sm ra-admin-listings__btn-view" onClick={() => openRow(r)}>
                        {t('admin.inquiries.open')}
                      </button>
                      <button
                        type="button"
                        className="ra-btn ra-btn--sm ra-admin-listings__btn-view"
                        onClick={() => {
                          if (getListingById(r.listingId)) navigate(`/listing/${r.listingId}`)
                          else window.alert(t('admin.owners.noPublicListing'))
                        }}
                      >
                        {t('admin.inquiries.viewListing')}
                      </button>
                      <button
                        type="button"
                        className="ra-btn ra-btn--sm"
                        onClick={() => {
                          void (async () => {
                            await fetch('/api/admin-inquiries', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({ ownerUserId: r.ownerUserId, id: r.id, patch: { paused: !r.paused } }),
                            }).catch(() => {})
                            const rr = await fetch('/api/admin-inquiries', { credentials: 'include' })
                            const jj = (await rr.json().catch(() => ({}))) as { ok?: boolean; inquiries?: (VisitorInquiryRecord & { ownerUserId: string })[] }
                            if (rr.ok && jj.ok && Array.isArray(jj.inquiries)) {
                              setRowsServer(jj.inquiries as Row[])
                            }
                            bump()
                          })()
                        }}
                      >
                        {r.paused ? t('admin.inquiries.resume') : t('admin.inquiries.pause')}
                      </button>
                      <button
                        type="button"
                        className="ra-btn ra-btn--sm ra-admin-listings__btn-del"
                        onClick={() => {
                          if (!window.confirm(t('admin.inquiries.confirmDelete'))) return
                          void (async () => {
                            await fetch('/api/admin-inquiries', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({ action: 'delete', ownerUserId: r.ownerUserId, id: r.id }),
                            }).catch(() => {})
                            const rr = await fetch('/api/admin-inquiries', { credentials: 'include' })
                            const jj = (await rr.json().catch(() => ({}))) as { ok?: boolean; inquiries?: (VisitorInquiryRecord & { ownerUserId: string })[] }
                            if (rr.ok && jj.ok && Array.isArray(jj.inquiries)) {
                              setRowsServer(jj.inquiries as Row[])
                            }
                            bump()
                          })()
                        }}
                      >
                        {t('admin.inquiries.delete')}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="ra-modal" role="dialog" onClick={() => setOpen(null)}>
          <div className="ra-modal__panel ra-admin-owners__modal ra-admin-owners__modal--wide" onClick={(e) => e.stopPropagation()}>
            <h2>{t('admin.inquiries.modalTitle')}</h2>
            <p className="ra-admin-owners__hint">
              {t('admin.inquiries.modalMeta', {
                from: `${open.first} ${open.last} <${open.email}>`,
                to: getOwnerProfileByUserId(open.ownerUserId)?.email ?? open.ownerUserId,
                date: formatDateDots(open.at),
              })}
            </p>
            <label className="ra-fld">
              <span>{t('admin.inquiries.fldMessage')}</span>
              <textarea rows={5} value={editMsg} onChange={(e) => setEditMsg(e.target.value)} />
            </label>
            <label className="ra-fld">
              <span>{t('admin.inquiries.fldReply')}</span>
              <textarea rows={4} value={editReply} onChange={(e) => setEditReply(e.target.value)} />
            </label>
            <div className="ra-admin-owners__modal-actions">
              <button type="button" className="ra-btn" onClick={() => setOpen(null)}>
                {t('admin.owners.cancel')}
              </button>
              <button type="button" className="ra-btn ra-btn--primary" onClick={saveEdit}>
                {t('admin.inquiries.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
