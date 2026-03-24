import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LISTING_IMAGE_FALLBACK } from '../data/listings'
import type { Listing } from '../types'
import { listingImageUrl } from '../utils/imageUrl'
import { listingTitle } from '../utils/listingTitle'

type SideAdsColumnProps = {
  items: Listing[]
  side: 'left' | 'right'
  onOpenListing: (listing: Listing) => void
}

const RESUME_MS = 2200

export function SideAdsColumn({ items, side, onOpenListing }: SideAdsColumnProps) {
  const { t } = useTranslation()
  const base = items.length > 0 ? items : []
  const loop = base.length > 0 ? [...base, ...base] : []
  const [paused, setPaused] = useState(false)
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const holdPause = useCallback(() => {
    setPaused(true)
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
  }, [])

  const releasePause = useCallback(() => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = setTimeout(() => setPaused(false), RESUME_MS)
  }, [])

  if (loop.length === 0) {
    return (
      <aside className={`ra-side ra-side--${side}`} aria-label="Listings">
        <div className="ra-side__mask ra-side__mask--empty" />
      </aside>
    )
  }

  return (
    <aside className={`ra-side ra-side--${side}`} aria-label="Listings">
      <div
        className={`ra-side__mask ${paused ? 'ra-side__mask--paused' : ''}`}
        onPointerDown={holdPause}
        onPointerUp={releasePause}
        onPointerCancel={releasePause}
      >
        <div className="ra-side__track">
          {loop.map((item, i) => (
            <button
              key={`${item.id}-${i}`}
              type="button"
              className="ra-side__card"
              onClick={() => onOpenListing(item)}
            >
              <div className="ra-side__img-wrap">
                <img
                  src={listingImageUrl(item.image)}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  onError={(e) => {
                    e.currentTarget.src = LISTING_IMAGE_FALLBACK
                  }}
                />
              </div>
              <h3 className="ra-side__title">{listingTitle(item, t)}</h3>
              <p className="ra-side__meta">{item.location}</p>
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
