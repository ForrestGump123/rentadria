import { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { buildListingDetail } from '../../data/listingDetail'
import { getListingById } from '../../data/listings'
import { listingTitle as listingTitleT } from '../../utils/listingTitle'
import { isAdminSession } from '../../utils/adminSession'
import { getAllOwnerListingRows, getOwnerProfileByUserId } from '../../utils/ownerSession'
import { listingImageUrl } from '../../utils/imageUrl'
import { isImageBlocked, listGalleryForAdmin, setGalleryOrder, toggleImageBlocked } from '../../utils/listingGalleryAdmin'

type Album = { listingId: string; ownerLabel: string; title: string }

export function AdminImagesPage() {
  const { t } = useTranslation()
  const [epoch, setEpoch] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)

  const bump = useCallback(() => setEpoch((e) => e + 1), [])

  useEffect(() => {
    const on = () => bump()
    window.addEventListener('rentadria-listing-gallery-admin-changed', on)
    return () => window.removeEventListener('rentadria-listing-gallery-admin-changed', on)
  }, [bump])

  const albums: Album[] = useMemo(() => {
    void epoch
    const seen = new Set<string>()
    const out: Album[] = []
    for (const row of getAllOwnerListingRows()) {
      const lid = row.publicListingId?.trim()
      if (!lid || seen.has(lid)) continue
      const listing = getListingById(lid)
      if (!listing) continue
      seen.add(lid)
      const p = getOwnerProfileByUserId(row.userId)
      out.push({
        listingId: lid,
        ownerLabel: p?.email ?? row.userId,
        title: listingTitleT(listing, t),
      })
    }
    return out.sort((a, b) => a.listingId.localeCompare(b.listingId))
  }, [epoch, t])

  const openAlbum = albums.find((a) => a.listingId === openId)
  const detail = openAlbum ? getListingById(openAlbum.listingId) : undefined
  const baseUrls = useMemo(() => {
    if (!detail) return []
    const d = buildListingDetail(detail)
    return d.gallery.map(listingImageUrl)
  }, [detail, epoch])

  const gallery = useMemo(() => {
    if (!openId || !baseUrls.length) return []
    return listGalleryForAdmin(openId, baseUrls)
  }, [openId, baseUrls, epoch])

  const move = (from: number, to: number) => {
    if (!openId || to < 0 || to >= gallery.length) return
    const next = gallery.slice()
    const [x] = next.splice(from, 1)
    next.splice(to, 0, x!)
    setGalleryOrder(openId, next)
    bump()
  }

  if (!isAdminSession()) return null

  return (
    <div className="ra-admin-inquiries">
      <Helmet>
        <title>{t('admin.images.pageTitle')} · RentAdria</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <header className="ra-admin-head">
        <h1 className="ra-admin-title">{t('admin.images.heading')}</h1>
        <p className="ra-admin-subtitle">{t('admin.images.lead')}</p>
      </header>

      {!openId ? (
        <div className="ra-admin-listings__table-wrap">
          <table className="ra-admin-listings__table">
            <thead>
              <tr>
                <th>{t('admin.images.colId')}</th>
                <th>{t('admin.images.colOwner')}</th>
                <th>{t('admin.images.colTitle')}</th>
                <th>{t('admin.images.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {albums.length === 0 ? (
                <tr>
                  <td colSpan={4} className="ra-admin-listings__empty">
                    {t('admin.images.empty')}
                  </td>
                </tr>
              ) : (
                albums.map((a) => (
                  <tr key={a.listingId}>
                    <td className="ra-admin-listings__mono">{a.listingId}</td>
                    <td>{a.ownerLabel}</td>
                    <td>{a.title}</td>
                    <td>
                      <button type="button" className="ra-btn ra-btn--sm ra-btn--primary" onClick={() => setOpenId(a.listingId)}>
                        {t('admin.images.openAlbum')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="ra-admin-images-album">
          <button type="button" className="ra-btn ra-btn--ghost" onClick={() => setOpenId(null)}>
            ← {t('admin.images.back')}
          </button>
          <h2 className="ra-admin-images-album__h">
            {openAlbum?.title} · {openAlbum?.listingId}
          </h2>
          <p className="ra-admin-listings__hint">{openAlbum?.ownerLabel}</p>
          <div className="ra-admin-images-grid">
            {gallery.map((url, i) => (
              <figure key={url} className="ra-admin-images-grid__cell">
                <img src={url} alt="" loading="lazy" />
                <figcaption className="ra-admin-images-grid__actions">
                  <button type="button" className="ra-btn ra-btn--sm" onClick={() => move(i, i - 1)} disabled={i === 0}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className="ra-btn ra-btn--sm"
                    onClick={() => move(i, i + 1)}
                    disabled={i === gallery.length - 1}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="ra-btn ra-btn--sm"
                    onClick={() => {
                      toggleImageBlocked(openId, url)
                      bump()
                    }}
                  >
                    {openId && isImageBlocked(openId, url) ? t('admin.images.unblock') : t('admin.images.block')}
                  </button>
                  <a className="ra-btn ra-btn--sm" href={url} download={`${openId}-${i + 1}.jpg`} target="_blank" rel="noreferrer">
                    {t('admin.images.download')}
                  </a>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
