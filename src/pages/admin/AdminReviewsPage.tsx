import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getListingById } from '../../data/listings'
import { fetchAdminOwnerListingsIndex } from '../../lib/adminListingsApi'
import { listingTitle as listingTitleT } from '../../utils/listingTitle'
import { isAdminSession } from '../../utils/adminSession'
import { formatDateDots } from '../../utils/ownerSession'
import { clearAdminReviewUnread, saveReviewsForListing, type StoredReview } from '../../utils/reviewStorage'

type ReviewBucket = { listingId: string; reviews: StoredReview[] }

export function AdminReviewsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [epoch, setEpoch] = useState(0)
  const [openListingId, setOpenListingId] = useState<string | null>(null)
  const [items, setItems] = useState<ReviewBucket[]>([])
  const [ownerByListingId, setOwnerByListingId] = useState<Record<string, string>>({})

  const bump = useCallback(() => setEpoch((e) => e + 1), [])

  const reload = useCallback(async () => {
    try {
      const r = await fetch('/api/admin-listing-reviews', { credentials: 'include' })
      const j = (await r.json()) as { ok?: boolean; items?: ReviewBucket[] }
      if (r.ok && j.ok && Array.isArray(j.items)) {
        setItems(j.items)
        return
      }
    } catch {
      /* ignore */
    }
    setItems([])
  }, [])

  useEffect(() => {
    clearAdminReviewUnread()
    bump()
  }, [bump])

  useEffect(() => {
    void reload()
  }, [reload, epoch])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const rows = await fetchAdminOwnerListingsIndex()
      if (cancelled || !rows) return
      const map: Record<string, string> = {}
      for (const r of rows) {
        const pid = r.publicListingId
        if (!pid) continue
        map[pid] = r.ownerUserId
      }
      setOwnerByListingId(map)
    })()
    return () => {
      cancelled = true
    }
  }, [epoch])

  useEffect(() => {
    const on = () => bump()
    window.addEventListener('rentadria-reviews-updated', on)
    return () => window.removeEventListener('rentadria-reviews-updated', on)
  }, [bump])

  const persistReviews = async (listingId: string, next: StoredReview[]) => {
    try {
      const r = await fetch('/api/admin-listing-reviews', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, reviews: next }),
      })
      if (r.ok) {
        saveReviewsForListing(listingId, next)
        setItems((prev) => {
          const rest = prev.filter((x) => x.listingId !== listingId)
          if (next.length === 0) return rest
          return [...rest, { listingId, reviews: next }]
        })
      }
    } catch {
      /* ignore */
    }
  }

  const patchReview = (listingId: string, reviewId: string, patch: Partial<StoredReview>) => {
    const bucket = items.find((x) => x.listingId === listingId)
    const rows = bucket?.reviews ?? []
    const next = rows.map((r) => (r.id === reviewId ? { ...r, ...patch } : r))
    void persistReviews(listingId, next)
  }

  const removeReview = (listingId: string, reviewId: string) => {
    if (!window.confirm(t('admin.reviews.confirmDelete'))) return
    const bucket = items.find((x) => x.listingId === listingId)
    const rows = bucket?.reviews ?? []
    const next = rows.filter((r) => r.id !== reviewId)
    void persistReviews(listingId, next)
  }

  const listingIds = useMemo(
    () => items.filter((x) => x.reviews.length > 0).map((x) => x.listingId),
    [items],
  )

  if (!isAdminSession()) return null

  return (
    <div className="ra-admin-inquiries">
      <Helmet>
        <title>{t('admin.reviews.pageTitle')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <header className="ra-admin-head">
        <h1 className="ra-admin-title">{t('admin.reviews.heading')}</h1>
        <p className="ra-admin-subtitle">{t('admin.reviews.lead')}</p>
      </header>

      <div className="ra-admin-listings__table-wrap">
        <table className="ra-admin-listings__table">
          <thead>
            <tr>
              <th>{t('admin.reviews.colListing')}</th>
              <th>{t('admin.reviews.colOwner')}</th>
              <th>{t('admin.reviews.colCount')}</th>
              <th>{t('admin.reviews.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {listingIds.length === 0 ? (
              <tr>
                <td colSpan={4} className="ra-admin-listings__empty">
                  {t('admin.reviews.empty')}
                </td>
              </tr>
            ) : (
              listingIds.map((lid) => {
                const listing = getListingById(lid)
                const title = listing ? listingTitleT(listing, t) : lid
                const reviews = items.find((x) => x.listingId === lid)?.reviews ?? []
                const expanded = openListingId === lid
                return (
                  <Fragment key={lid}>
                    <tr className="ra-admin-reviews__summary-row">
                      <td>
                        <button
                          type="button"
                          className="ra-admin-owner-msg__link"
                          onClick={() => setOpenListingId(expanded ? null : lid)}
                        >
                          {title}
                        </button>
                        <div className="ra-admin-listings__hint">{lid}</div>
                      </td>
                      <td>{ownerByListingId[lid] ?? '—'}</td>
                      <td>{reviews.length}</td>
                      <td className="ra-admin-listings__actions">
                        <button
                          type="button"
                          className="ra-btn ra-btn--sm ra-admin-listings__btn-view"
                          onClick={() => {
                            if (listing) navigate(`/listing/${lid}`)
                            else window.alert(t('admin.owners.noPublicListing'))
                          }}
                        >
                          {t('admin.inquiries.viewListing')}
                        </button>
                      </td>
                    </tr>
                    {expanded &&
                      reviews.map((r) => (
                        <tr key={r.id} className="ra-admin-reviews__detail-row">
                          <td colSpan={4}>
                            <div className="ra-admin-reviews__detail">
                              <div className="ra-admin-reviews__detail-meta">
                                ★ {r.rating} · {formatDateDots(r.at)}
                                {r.hidden ? ` · ${t('admin.reviews.hidden')}` : ''}
                                {r.blocked ? ` · ${t('admin.reviews.blocked')}` : ''}
                              </div>
                              <p>{r.text}</p>
                              <div className="ra-admin-reviews__detail-actions">
                                <button
                                  type="button"
                                  className="ra-btn ra-btn--sm"
                                  onClick={() => patchReview(lid, r.id, { hidden: !r.hidden })}
                                >
                                  {r.hidden ? t('admin.reviews.unhide') : t('admin.reviews.hide')}
                                </button>
                                <button
                                  type="button"
                                  className="ra-btn ra-btn--sm"
                                  onClick={() => patchReview(lid, r.id, { blocked: !r.blocked })}
                                >
                                  {r.blocked ? t('admin.reviews.unblock') : t('admin.reviews.block')}
                                </button>
                                <button
                                  type="button"
                                  className="ra-btn ra-btn--sm ra-admin-listings__btn-del"
                                  onClick={() => removeReview(lid, r.id)}
                                >
                                  {t('admin.inquiries.delete')}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
