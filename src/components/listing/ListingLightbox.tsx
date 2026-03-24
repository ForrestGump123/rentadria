import { useCallback, useEffect } from 'react'

type ListingLightboxProps = {
  images: string[]
  index: number
  onClose: () => void
  onIndex: (i: number) => void
}

export function ListingLightbox({ images, index, onClose, onIndex }: ListingLightboxProps) {
  const safe = images.length ? images : []
  const i = ((index % safe.length) + safe.length) % safe.length
  const src = safe[i]

  const next = useCallback(() => onIndex((i + 1) % safe.length), [i, onIndex, safe.length])
  const prev = useCallback(
    () => onIndex((i - 1 + safe.length) % safe.length),
    [i, onIndex, safe.length],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, next, prev])

  let touchStartX = 0

  if (!safe.length) return null

  return (
    <div
      className="ra-lb"
      role="dialog"
      aria-modal="true"
      aria-label="Gallery"
      onClick={onClose}
    >
      <button type="button" className="ra-lb__close" onClick={(e) => { e.stopPropagation(); onClose() }} aria-label="Close">
        ×
      </button>
      <button type="button" className="ra-lb__nav ra-lb__nav--prev" onClick={(e) => { e.stopPropagation(); prev() }} aria-label="Previous">
        ‹
      </button>
      <div className="ra-lb__stage">
        <img
          src={src}
          alt=""
          className="ra-lb__img"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => {
            touchStartX = e.changedTouches[0]?.clientX ?? 0
          }}
          onTouchEnd={(e) => {
            const x = e.changedTouches[0]?.clientX ?? 0
            const d = x - touchStartX
            if (Math.abs(d) > 50) d < 0 ? next() : prev()
          }}
        />
      </div>
      <button type="button" className="ra-lb__nav ra-lb__nav--next" onClick={(e) => { e.stopPropagation(); next() }} aria-label="Next">
        ›
      </button>
    </div>
  )
}
