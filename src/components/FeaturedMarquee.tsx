import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrency } from '../context/CurrencyContext'
import { LISTING_IMAGE_FALLBACK } from '../data/listings'
import type { Listing } from '../types'
import { listingImageUrl } from '../utils/imageUrl'
import { listingTitle } from '../utils/listingTitle'

type FeaturedMarqueeProps = {
  items: Listing[]
  onOpenListing: (listing: Listing) => void
}

/** Ista brzina kao bočne kolone (`SideAdsColumn` AUTO_SCROLL_PX). */
const AUTO_SCROLL_PX = 0.75

const DRAG_THRESHOLD = 12

export function FeaturedMarquee({ items, onOpenListing }: FeaturedMarqueeProps) {
  const { t } = useTranslation()
  const { formatPriceLabel } = useCurrency()
  const row = items.length > 0 ? [...items, ...items] : []
  const scrollRef = useRef<HTMLDivElement>(null)
  const halfWidthRef = useRef(0)
  const reduceMotionRef = useRef(false)
  const dragActiveRef = useRef(false)
  const touchRef = useRef(false)
  const activeRef = useRef(false)
  const startRef = useRef({ x: 0, y: 0 })
  const draggedRef = useRef(false)
  const dragScroll = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false })

  const updateHalfWidth = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    halfWidthRef.current = el.scrollWidth / 2
  }, [])

  useLayoutEffect(() => {
    updateHalfWidth()
  }, [items, updateHalfWidth])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => updateHalfWidth())
    ro.observe(el)
    return () => ro.disconnect()
  }, [updateHalfWidth])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduceMotionRef.current = mq.matches
    const onChange = () => {
      reduceMotionRef.current = mq.matches
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0
  }, [items])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const h = halfWidthRef.current
      if (h <= 4) return
      if (el.scrollLeft >= h - 1) el.scrollLeft -= h
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [items])

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const el = scrollRef.current
      const half = halfWidthRef.current
      if (
        el &&
        half > 4 &&
        !reduceMotionRef.current &&
        !dragActiveRef.current &&
        !touchRef.current
      ) {
        el.scrollLeft += AUTO_SCROLL_PX
        if (el.scrollLeft >= half - 1) el.scrollLeft = 0
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [items.length])

  const onPointerDown = (e: React.PointerEvent) => {
    activeRef.current = true
    draggedRef.current = false
    startRef.current = { x: e.clientX, y: e.clientY }
    const el = scrollRef.current
    if (el) {
      dragScroll.current = {
        active: true,
        startX: e.clientX,
        scrollLeft: el.scrollLeft,
        moved: false,
      }
      dragActiveRef.current = true
      el.setPointerCapture(e.pointerId)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!activeRef.current) return
    const dx = Math.abs(e.clientX - startRef.current.x)
    const dy = Math.abs(e.clientY - startRef.current.y)
    if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) draggedRef.current = true
    if (dragScroll.current.active) {
      const el = scrollRef.current
      if (!el) return
      const d = e.clientX - dragScroll.current.startX
      if (Math.abs(d) > 4) dragScroll.current.moved = true
      el.scrollLeft = dragScroll.current.scrollLeft - d
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    activeRef.current = false
    dragActiveRef.current = false
    if (dragScroll.current.active) {
      dragScroll.current.active = false
      try {
        scrollRef.current?.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
  }

  if (items.length === 0) {
    return (
      <section className="ra-marquee-section" aria-label={t('sections.featured')}>
        <div className="ra-section-head">
          <h2>{t('sections.featured')}</h2>
        </div>
        <div className="ra-marquee ra-marquee--empty">
          <p className="ra-marquee__empty-msg">{t('search.noResults')}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="ra-marquee-section" aria-label={t('sections.featured')}>
      <div className="ra-section-head">
        <h2>{t('sections.featured')}</h2>
      </div>
      <div
        ref={scrollRef}
        className="ra-marquee ra-marquee--js-scroll"
        role="presentation"
        onTouchStart={() => {
          touchRef.current = true
        }}
        onTouchEnd={() => {
          window.setTimeout(() => {
            touchRef.current = false
          }, 450)
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="ra-marquee__track ra-marquee__track--js">
          {row.map((item, i) => (
            <button
              key={`${item.id}-m-${i}`}
              type="button"
              className="ra-marquee__card"
              onClick={() => {
                if (draggedRef.current || dragScroll.current.moved) return
                onOpenListing(item)
              }}
            >
              <div className="ra-marquee__img">
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
