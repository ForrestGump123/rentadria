import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrency } from '../context/CurrencyContext'
import type { Listing } from '../types'
import { listingImageUrl } from '../utils/imageUrl'
import { listingTitle } from '../utils/listingTitle'

type FeaturedMarqueeProps = {
  items: Listing[]
  onOpenListing: (listing: Listing) => void
}

const DRAG_THRESHOLD = 12

export function FeaturedMarquee({ items, onOpenListing }: FeaturedMarqueeProps) {
  const { t } = useTranslation()
  const { formatPriceLabel } = useCurrency()
  const row = items.length > 0 ? [...items, ...items] : []
  const activeRef = useRef(false)
  const startRef = useRef({ x: 0, y: 0 })
  const draggedRef = useRef(false)

  const onPointerDown = (e: React.PointerEvent) => {
    activeRef.current = true
    draggedRef.current = false
    startRef.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!activeRef.current) return
    const dx = Math.abs(e.clientX - startRef.current.x)
    const dy = Math.abs(e.clientY - startRef.current.y)
    if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) draggedRef.current = true
  }

  const onPointerUp = () => {
    activeRef.current = false
  }

  return (
    <section className="ra-marquee-section" aria-label={t('sections.featured')}>
      <div className="ra-section-head">
        <h2>{t('sections.featured')}</h2>
      </div>
      <div
        className="ra-marquee"
        role="presentation"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div className="ra-marquee__track">
          {row.map((item, i) => (
            <button
              key={`${item.id}-m-${i}`}
              type="button"
              className="ra-marquee__card"
              onClick={() => {
                if (draggedRef.current) return
                onOpenListing(item)
              }}
            >
              <div className="ra-marquee__img">
                <img src={listingImageUrl(item.image)} alt="" loading="lazy" draggable={false} />
              </div>
              <div className="ra-marquee__body">
                <h3>{listingTitle(item, t)}</h3>
                <p>{item.location}</p>
                <span className="ra-marquee__price">{formatPriceLabel(item.priceLabel)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
