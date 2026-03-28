import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
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

const AUTO_SCROLL_PX = 0.75

export function SideAdsColumn({ items, side, onOpenListing }: SideAdsColumnProps) {
  const { t } = useTranslation()
  const base = items.length > 0 ? items : []
  const loop = base.length > 0 ? [...base, ...base] : []
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragActiveRef = useRef(false)
  const touchRef = useRef(false)
  const halfHeightRef = useRef(0)
  const reduceMotionRef = useRef(false)
  const dragState = useRef({
    active: false,
    startY: 0,
    scrollTop: 0,
    moved: false,
  })

  const updateHalfHeight = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    halfHeightRef.current = el.scrollHeight / 2
  }, [])

  useLayoutEffect(() => {
    updateHalfHeight()
  }, [items, updateHalfHeight])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => updateHalfHeight())
    ro.observe(el)
    return () => ro.disconnect()
  }, [updateHalfHeight])

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
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [items])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const h = halfHeightRef.current
      if (h <= 4) return
      if (el.scrollTop >= h - 1) el.scrollTop -= h
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [items])

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const el = scrollRef.current
      const half = halfHeightRef.current
      if (
        el &&
        half > 4 &&
        !reduceMotionRef.current &&
        !dragActiveRef.current &&
        !touchRef.current
      ) {
        el.scrollTop += AUTO_SCROLL_PX
        if (el.scrollTop >= half - 1) el.scrollTop = 0
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [items.length])

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    const el = scrollRef.current
    if (!el) return
    dragState.current = {
      active: true,
      startY: e.clientY,
      scrollTop: el.scrollTop,
      moved: false,
    }
    dragActiveRef.current = true
    el.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    if (!dragState.current.active) return
    const el = scrollRef.current
    if (!el) return
    const dy = e.clientY - dragState.current.startY
    if (Math.abs(dy) > 6) dragState.current.moved = true
    el.scrollTop = dragState.current.scrollTop - dy
  }, [])

  const endPointer = useCallback((e: ReactPointerEvent) => {
    if (!dragState.current.active) return
    dragState.current.active = false
    dragActiveRef.current = false
    try {
      scrollRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  const onCardOpen = useCallback(
    (listing: Listing) => {
      if (dragState.current.moved) {
        dragState.current.moved = false
        return
      }
      onOpenListing(listing)
    },
    [onOpenListing],
  )

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
        ref={scrollRef}
        className="ra-side__mask ra-side__mask--scroll-auto"
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
        <div className="ra-side__track ra-side__track--scroll-auto">
          {loop.map((item, i) => (
            <button
              key={`${item.id}-${i}`}
              type="button"
              className="ra-side__card"
              onClick={() => onCardOpen(item)}
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
