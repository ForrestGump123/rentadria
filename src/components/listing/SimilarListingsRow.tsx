import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCurrency } from '../../context/CurrencyContext'
import type { Listing } from '../../types'
import { LISTING_IMAGE_FALLBACK } from '../../data/listings'
import { listingImageUrl } from '../../utils/imageUrl'
import { listingTitle } from '../../utils/listingTitle'

type SimilarListingsRowProps = {
  items: Listing[]
}

/** ~40–50 px/s pri ~60 fps; pauza samo pri dragu / dodiru, ne na hover */
const AUTO_SCROLL_PX = 0.75

export function SimilarListingsRow({ items }: SimilarListingsRowProps) {
  const { t } = useTranslation()
  const { formatPriceLabel } = useCurrency()
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragActiveRef = useRef(false)
  const touchRef = useRef(false)
  const halfWidthRef = useRef(0)
  const [autoEnabled] = useState(() => {
    // Auto-scroll is fun on desktop, but on Android Chrome it can be a stability/perf killer.
    // Disable on touch/coarse pointers and when user requests reduced motion.
    try {
      if (typeof window === 'undefined' || !window.matchMedia) return true
      const coarse = window.matchMedia('(pointer: coarse)').matches
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      return !(coarse || reduce)
    } catch {
      return true
    }
  })
  const dragState = useRef({
    active: false,
    startX: 0,
    scrollLeft: 0,
    moved: false,
  })

  const row = items.length > 0 ? [...items, ...items] : []

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
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => updateHalfWidth())
    ro.observe(el)
    return () => ro.disconnect()
  }, [updateHalfWidth])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = 0
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
    if (!autoEnabled) return
    let raf = 0
    const tick = () => {
      const el = scrollRef.current
      const half = halfWidthRef.current
      if (
        el &&
        half > 4 &&
        !dragActiveRef.current &&
        !touchRef.current &&
        (typeof document === 'undefined' || document.visibilityState === 'visible')
      ) {
        el.scrollLeft += AUTO_SCROLL_PX
        if (el.scrollLeft >= half - 1) el.scrollLeft = 0
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [items.length, autoEnabled])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = scrollRef.current
    if (!el) return
    dragState.current = {
      active: true,
      startX: e.clientX,
      scrollLeft: el.scrollLeft,
      moved: false,
    }
    dragActiveRef.current = true
    el.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.active) return
    const el = scrollRef.current
    if (!el) return
    const dx = e.clientX - dragState.current.startX
    if (Math.abs(dx) > 6) dragState.current.moved = true
    el.scrollLeft = dragState.current.scrollLeft - dx
  }, [])

  const endPointer = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.active) return
    dragState.current.active = false
    dragActiveRef.current = false
    try {
      scrollRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  const onCardNavigate = useCallback(
    (id: string) => {
      if (dragState.current.moved) {
        dragState.current.moved = false
        return
      }
      navigate(`/listing/${id}`)
    },
    [navigate],
  )

  if (!items.length) return null

  return (
    <section className="ra-similar-section" aria-label={t('detail.similar.title')}>
      <h2 className="ra-similar-h">{t('detail.similar.title')}</h2>
      <div
        ref={scrollRef}
        className="ra-marquee ra-marquee--similar ra-marquee--similar-auto"
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
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <div className="ra-marquee__track ra-marquee__track--similar-auto">
          {row.map((item, i) => (
            <button
              key={`${item.id}-${i}`}
              type="button"
              className="ra-marquee__card"
              onClick={() => onCardNavigate(item.id)}
            >
              <div className="ra-marquee__img">
                <img
                  src={listingImageUrl(item.image)}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  onError={(ev) => {
                    ev.currentTarget.src = LISTING_IMAGE_FALLBACK
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
