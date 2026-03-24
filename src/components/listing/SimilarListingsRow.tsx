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

export function SimilarListingsRow({ items }: SimilarListingsRowProps) {
  const { t } = useTranslation()
  const { formatPriceLabel } = useCurrency()
  const navigate = useNavigate()
  const row = items.length > 0 ? [...items, ...items] : []

  if (!row.length) return null

  return (
    <section className="ra-similar-section" aria-label={t('detail.similar.title')}>
      <h2 className="ra-similar-h">{t('detail.similar.title')}</h2>
      <div className="ra-marquee ra-marquee--similar">
        <div className="ra-marquee__track">
          {row.map((item, i) => (
            <button
              key={`${item.id}-sim-${i}`}
              type="button"
              className="ra-marquee__card"
              onClick={() => navigate(`/listing/${item.id}`)}
            >
              <div className="ra-marquee__img">
                <img
                  src={listingImageUrl(item.image)}
                  alt=""
                  loading="lazy"
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
