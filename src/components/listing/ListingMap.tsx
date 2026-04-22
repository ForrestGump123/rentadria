import L from 'leaflet'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'

const pinIcon = L.divIcon({
  className: 'ra-leaflet-pin',
  html: '<span aria-hidden="true">📍</span>',
  iconSize: [32, 36],
  iconAnchor: [16, 34],
})

type ListingMapProps = {
  lat: number
  lng: number
}

export function ListingMap({ lat, lng }: ListingMapProps) {
  const { t } = useTranslation()
  const href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  const wrapRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (mounted) return
    const el = wrapRef.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setMounted(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true)
          io.disconnect()
        }
      },
      { rootMargin: '250px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [mounted])

  return (
    <div ref={wrapRef} className="ra-map-wrap">
      <h3 className="ra-map-title">{t('detail.map.title')}</h3>
      {mounted ? (
        <MapContainer
          center={[lat, lng]}
          zoom={14}
          className="ra-map-cv"
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap"
          />
          <Marker position={[lat, lng]} icon={pinIcon} />
        </MapContainer>
      ) : (
        <div className="ra-map-cv" aria-hidden />
      )}
      <a className="ra-map-gm" href={href} target="_blank" rel="noreferrer">
        {t('detail.map.openGoogle')} →
      </a>
    </div>
  )
}
