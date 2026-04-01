import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SearchCountryId } from '../data/cities/countryIds'
import { LISTING_IMAGE_FALLBACK } from '../data/listings'
import type { AdminBannerItem } from '../utils/adminBannersStore'
import { listBannersForSlot } from '../utils/adminBannersStore'
import { listingImageUrl } from '../utils/imageUrl'

const SEEN_PREFIX = 'rentadria_popup_ad_seen:'

type EntryPopupBannerProps = {
  searchCountryId: SearchCountryId | null
  /** Bumps when admin mijenja banere (isti tab ili storage). */
  epoch: number
}

export function EntryPopupBanner({ searchCountryId, epoch }: EntryPopupBannerProps) {
  const { t } = useTranslation()
  const [banner, setBanner] = useState<AdminBannerItem | null>(null)

  useEffect(() => {
    const list = listBannersForSlot('popup', searchCountryId)
    const pick = list.find((b) => {
      try {
        return !sessionStorage.getItem(SEEN_PREFIX + b.id)
      } catch {
        return true
      }
    })
    setBanner(pick ?? null)
  }, [searchCountryId, epoch])

  if (!banner) return null

  const src = banner.imageDataUrl?.trim() ? banner.imageDataUrl : LISTING_IMAGE_FALLBACK

  const close = () => {
    try {
      sessionStorage.setItem(SEEN_PREFIX + banner.id, '1')
    } catch {
      /* ignore */
    }
    setBanner(null)
  }

  return (
    <div className="ra-modal" role="dialog" aria-modal="true" aria-labelledby="entry-popup-title" onClick={close}>
      <div className="ra-modal__panel ra-entry-popup" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ra-modal__close" onClick={close} aria-label={t('admin.banners.popupDismiss')}>
          ×
        </button>
        <div className="ra-entry-popup__media">
          <img src={listingImageUrl(src)} alt="" className="ra-entry-popup__img" />
        </div>
        <div className="ra-entry-popup__body">
          <h2 id="entry-popup-title" className="ra-entry-popup__title">
            {banner.title}
          </h2>
          {banner.description.trim() ? <p className="ra-entry-popup__desc">{banner.description}</p> : null}
        </div>
        <button type="button" className="ra-btn ra-btn--primary ra-entry-popup__ok" onClick={close}>
          {t('admin.banners.popupDismiss')}
        </button>
      </div>
    </div>
  )
}
