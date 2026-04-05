import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrency } from '../context/CurrencyContext'
import { LISTING_IMAGE_FALLBACK } from '../data/listings'
import type { Listing } from '../types'
import { isAdminPromoListingId } from '../utils/adminBannerListings'
import { listingImageUrl } from '../utils/imageUrl'
import { listingTitle } from '../utils/listingTitle'

type MobileSidePromoStripProps = {
  sideLeft: Listing[]
  sideRight: Listing[]
  onOpenListing: (listing: Listing) => void
}

/** Ista brzina kao FeaturedMarquee / SideAdsColumn. */
const AUTO_SCROLL_PX = 0.75
const DRAG_THRESHOLD = 12

/** L0, R0, L1, R1… bez duplog id (lijeva + desna kolona kao jedan tok). */
function interleaveSidePromoItems(left: Listing[], right: Listing[]): Listing[] {
  const seen = new Set<string>()
  const out: Listing[] = []
  const n = Math.max(left.length, right.length)
  for (let i = 0; i < n; i++) {
    const a = left[i]
    const b = right[i]
    if (a && !seen.has(a.id)) {
      seen.add(a.id)
      out.push(a)
    }
    if (b && !seen.has(b.id)) {
      seen.add(b.id)
      out.push(b)
    }
  }
  return out
}

export function MobileSidePromoStrip({ sideLeft, sideRight, onOpenListing }: MobileSidePromoStripProps) {
  const { t } = useTranslation()
  const { formatPriceLabel } = useCurrency()

  const items = useMemo(() => interleaveSidePromoItems(sideLeft, sideRight), [sideLeft, sideRight])
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

  if (items.length === 0) return null

  return (
    <section className="ra-mobile-side-strip-wrap" aria-label={t('hero.sideStripMobAria')}>
      <div className="ra-section-head ra-mobile-side-strip-wrap__head">
        <h2 className="ra-mobile-side-strip-wrap__h">{t('hero.sideStripMobTitle')}</h2>
        <p className="ra-mobile-side-strip-wrap__hint">{t('hero.sideStripMobHint')}</p>
      </div>
      <div
        ref={scrollRef}
        className="ra-marquee ra-marquee--js-scroll ra-promo-sides-marquee"
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
          {row.map((item, i) => {
            const promo = isAdminPromoListingId(item.id)
            return (
              <button
                key={`${item.id}-ps-${i}`}
                type="button"
                className={`ra-marquee__card ${promo ? 'ra-marquee__card--promo-side' : ''}`}
                onClick={() => {
                  if (draggedRef.current || dragScroll.current.moved) return
                  onOpenListing(item)
                }}
              >
                {promo ? (
                  <span className="ra-promo-sides__badge">{t('search.sponsoredBadge')}</span>
                ) : null}
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
            )
          })}
        </div>
      </div>
    </section>
  )
}
