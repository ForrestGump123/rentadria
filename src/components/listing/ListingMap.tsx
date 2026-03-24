import L from 'leaflet'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import { useTranslation } from 'react-i18next'

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

  return (
    <div className="ra-map-wrap">
      <h3 className="ra-map-title">{t('detail.map.title')}</h3>
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        className="ra-map-cv"
        scrollWheelZoom={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        <Marker position={[lat, lng]} icon={pinIcon} />
      </MapContainer>
      <a className="ra-map-gm" href={href} target="_blank" rel="noreferrer">
        {t('detail.map.openGoogle')} →
      </a>
    </div>
  )
}
