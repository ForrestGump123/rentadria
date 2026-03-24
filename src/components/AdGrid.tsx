import { useTranslation } from 'react-i18next'
import { useCurrency } from '../context/CurrencyContext'
import type { Listing } from '../types'
import { listingImageUrl } from '../utils/imageUrl'
import { listingTitle } from '../utils/listingTitle'

const PAGE_SIZE = 20

type AdGridProps = {
  items: Listing[]
  page: number
  onPage: (p: number) => void
  onOpenListing: (listing: Listing) => void
}

export function AdGrid({ items, page, onPage, onOpenListing }: AdGridProps) {
  const { t } = useTranslation()
  const { formatPriceLabel } = useCurrency()
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const slice = items.slice(start, start + PAGE_SIZE)

  return (
    <section className="ra-grid-section" aria-labelledby="listings-heading">
      <div className="ra-section-head">
        <h2 id="listings-heading">{t('sections.listings')}</h2>
      </div>
      <div className="ra-grid">
        {slice.map((item) => (
          <button
            key={item.id}
            type="button"
            className="ra-grid__card"
            onClick={() => onOpenListing(item)}
          >
            <div className="ra-grid__img">
              <img src={listingImageUrl(item.image)} alt="" loading="lazy" draggable={false} />
              {item.verified && (
                <span className="ra-grid__verified" title={t('detail.verifiedTitle')}>
                  {t('detail.verified')}
                </span>
              )}
            </div>
            <div className="ra-grid__body">
              <h3>{listingTitle(item, t)}</h3>
              <p className="ra-grid__loc">{item.location}</p>
              <p className="ra-grid__price">
                {t('card.from')} {formatPriceLabel(item.priceLabel)}
              </p>
            </div>
          </button>
        ))}
      </div>

      {totalPages > 1 && (
        <nav className="ra-pagination" aria-label="Pagination">
          <button
            type="button"
            className="ra-btn ra-btn--ghost"
            disabled={safePage <= 1}
            onClick={() => onPage(safePage - 1)}
          >
            {t('pagination.prev')}
          </button>
          <span className="ra-pagination__info">
            {t('pagination.page', { current: safePage, total: totalPages })}
          </span>
          <button
            type="button"
            className="ra-btn ra-btn--ghost"
            disabled={safePage >= totalPages}
            onClick={() => onPage(safePage + 1)}
          >
            {t('pagination.next')}
          </button>
        </nav>
      )}
    </section>
  )
}
