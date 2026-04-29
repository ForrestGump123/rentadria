import { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getListingById } from '../../data/listings'
import { listingTitle as listingTitleT } from '../../utils/listingTitle'
import { isAdminSession } from '../../utils/adminSession'
import { shortOwnerId } from '../../utils/ownerDisplayId'
import {
  applyListingGalleryOverlayFromPayload,
  clearGalleryAdminOwnerContext,
  isImageBlocked,
  listGalleryForAdmin,
  setGalleryAdminOwnerContext,
  setGalleryOrder,
  toggleImageBlocked,
} from '../../utils/listingGalleryAdmin'
import { fetchAdminListingGalleryAlbums, type AdminGalleryAlbumRow } from '../../lib/adminListingGalleryApi'

function compactId(value: string): string {
  const s = value.trim()
  if (s.length <= 28) return s
  return `${s.slice(0, 18)}…${s.slice(-8)}`
}

function ownerLabel(ownerDisplayName: string, ownerUserId: string): string {
  const name = ownerDisplayName.trim()
  if (name && name.toLowerCase() !== ownerUserId.trim().toLowerCase()) return name
  return shortOwnerId(ownerUserId)
}

export function AdminImagesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [epoch, setEpoch] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [albums, setAlbums] = useState<AdminGalleryAlbumRow[]>([])
  const [loadError, setLoadError] = useState(false)

  const bump = useCallback(() => setEpoch((e) => e + 1), [])

  const reloadAlbums = useCallback(async () => {
    const rows = await fetchAdminListingGalleryAlbums()
    if (rows === null) {
      setAlbums([])
      setLoadError(true)
      return
    }
    setLoadError(false)
    setAlbums(rows)
  }, [])

  useEffect(() => {
    void reloadAlbums()
  }, [reloadAlbums])

  useEffect(() => {
    const on = () => bump()
    window.addEventListener('rentadria-listing-gallery-admin-changed', on)
    return () => window.removeEventListener('rentadria-listing-gallery-admin-changed', on)
  }, [bump])

  const openAlbum = useMemo(() => albums.find((a) => a.listingId === openId) ?? null, [albums, openId])

  useEffect(() => {
    if (!openId || !openAlbum) return
    setGalleryAdminOwnerContext(openAlbum.listingId, openAlbum.ownerUserId)
    applyListingGalleryOverlayFromPayload(openAlbum.listingId, openAlbum.blockedUrls, openAlbum.orderedUrls)
    return () => {
      clearGalleryAdminOwnerContext(openAlbum.listingId)
    }
  }, [openId, openAlbum])

  const displayTitle = useMemo(() => {
    if (!openAlbum) return ''
    const listing = getListingById(openAlbum.listingId)
    return listing ? listingTitleT(listing, t) : openAlbum.title || openAlbum.listingId
  }, [openAlbum, t])

  const gallery = useMemo(() => {
    void epoch
    if (!openId || !openAlbum?.baseUrls?.length) return []
    return listGalleryForAdmin(openId, openAlbum.baseUrls)
  }, [openId, openAlbum, epoch])

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
        {loadError ? <p className="ra-admin-listings__hint">{t('admin.images.loadError')}</p> : null}
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
                albums.map((a) => {
                  const listing = getListingById(a.listingId)
                  const title = listing ? listingTitleT(listing, t) : a.title || a.listingId
                  const owner = ownerLabel(a.ownerDisplayName, a.ownerUserId)
                  return (
                    <tr key={a.listingId}>
                      <td className="ra-admin-listings__mono" title={a.listingId}>
                        {compactId(a.listingId)}
                      </td>
                      <td title={a.ownerUserId}>{owner}</td>
                      <td>{title}</td>
                      <td>
                        <button
                          type="button"
                          className="ra-btn ra-btn--sm ra-btn--primary"
                          onClick={() => setOpenId(a.listingId)}
                        >
                          {t('admin.images.openAlbum')}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="ra-admin-images-album">
          <div className="ra-admin-listings__actions" style={{ marginBottom: 12 }}>
            <button type="button" className="ra-btn ra-btn--ghost" onClick={() => setOpenId(null)}>
              ← {t('admin.images.back')}
            </button>
            {openAlbum ? (
              <button
                type="button"
                className="ra-btn ra-btn--sm ra-admin-listings__btn-view"
                onClick={() => navigate(`/listing/${openAlbum.listingId}`)}
              >
                {t('admin.inquiries.viewListing')}
              </button>
            ) : null}
          </div>
          <h2 className="ra-admin-images-album__h">
            {displayTitle} · {openAlbum ? compactId(openAlbum.listingId) : ''}
          </h2>
          <p className="ra-admin-listings__hint" title={openAlbum?.ownerUserId}>
            {openAlbum ? ownerLabel(openAlbum.ownerDisplayName, openAlbum.ownerUserId) : ''}
          </p>
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
                      if (!openId) return
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
