import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LISTING_IMAGE_FALLBACK } from '../data/listings'
import type { Listing, ListingCategory } from '../types'
import type { SearchCountryId } from '../data/cities/countryIds'
import { useCurrency } from '../context/CurrencyContext'
import { listingImageUrl } from '../utils/imageUrl'
import { listingTitle } from '../utils/listingTitle'
import { HeroSearchBar } from './HeroSearchBar'

type HeroSlideshowProps = {
  category: ListingCategory
  slides: Listing[]
  intervalMs?: number
  onOpenListing: (listing: Listing) => void
  searchCountryId: SearchCountryId | null
  onSearchCountryId: (id: SearchCountryId | null) => void
  searchCity: string
  onSearchCity: (v: string) => void
  cities: string[]
  citiesLoading: boolean
  onSearchSubmit: () => void
}

const FLOAT_ICON: Record<ListingCategory, string> = {
  accommodation: '🏠',
  car: '🚗',
  motorcycle: '🏍️',
}

export function HeroSlideshow({
  category,
  slides,
  intervalMs = 8500,
  onOpenListing,
  searchCountryId,
  onSearchCountryId,
  searchCity,
  onSearchCity,
  cities,
  citiesLoading,
  onSearchSubmit,
}: HeroSlideshowProps) {
  const { t } = useTranslation()
  const { formatPriceLabel } = useCurrency()
  const [index, setIndex] = useState(0)
  const [heroSrc, setHeroSrc] = useState<string>('')
  const safe = slides.length > 0 ? slides : []
  const current = safe.length ? safe[index % safe.length] : undefined
  const h = `hero.${category}` as const

  useEffect(() => {
    if (current) setHeroSrc(listingImageUrl(current.image))
  }, [current])

  useEffect(() => {
    if (safe.length <= 1) return
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % safe.length)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [safe.length, intervalMs])

  useEffect(() => {
    setIndex(0)
  }, [slides, category])

  if (!current) {
    return (
      <section className="ra-hero">
        <div className="ra-hero__media ra-hero__media--empty">
          <div className="ra-hero__overlay" />
          <div className="ra-hero__content">
            <p className="ra-hero__badge">{t(`${h}.badge`)}</p>
            <h1 className="ra-hero__title">
              {t(`${h}.titleBefore`)}{' '}
              <span className="ra-hero__title-accent">{t(`${h}.titleHighlight`)}</span>
            </h1>
            <p className="ra-hero__subtitle">{t(`${h}.subtitle`)}</p>
            <HeroSearchBar
              countryId={searchCountryId}
              onCountryId={onSearchCountryId}
              city={searchCity}
              onCity={onSearchCity}
              cities={cities}
              citiesLoading={citiesLoading}
              onSubmit={onSearchSubmit}
            />
            <p className="ra-hero__no-slides">{t('search.noResults')}</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="ra-hero">
      <div className="ra-hero__media">
        <img
          src={heroSrc || listingImageUrl(current.image)}
          alt=""
          className="ra-hero__img"
          loading="eager"
          onError={() => setHeroSrc(LISTING_IMAGE_FALLBACK)}
        />
        <div className="ra-hero__overlay" />
        <button
          type="button"
          className="ra-hero__backdrop-hit"
          onClick={() => onOpenListing(current)}
          aria-label={t('listingPage.openAria')}
        />
        <div className="ra-hero__content">
          <p className="ra-hero__badge">{t(`${h}.badge`)}</p>
          <h1 className="ra-hero__title">
            {t(`${h}.titleBefore`)}{' '}
            <span className="ra-hero__title-accent">{t(`${h}.titleHighlight`)}</span>
          </h1>
          <p className="ra-hero__subtitle">{t(`${h}.subtitle`)}</p>

          <HeroSearchBar
            countryId={searchCountryId}
            onCountryId={onSearchCountryId}
            city={searchCity}
            onCity={onSearchCity}
            cities={cities}
            citiesLoading={citiesLoading}
            onSubmit={onSearchSubmit}
          />

          <div className="ra-stats">
            <div>
              <strong>12,400+</strong>
              <span>{t('stats.accommodations')}</span>
            </div>
            <div>
              <strong>3,400+</strong>
              <span>{t('stats.cars')}</span>
            </div>
            <div>
              <strong>1,900+</strong>
              <span>{t('stats.motorcycles')}</span>
            </div>
            <div>
              <strong>5</strong>
              <span>{t('stats.countries')}</span>
            </div>
          </div>

          <button
            type="button"
            className="ra-hero__floating"
            onClick={() => onOpenListing(current)}
          >
            <span aria-hidden>{FLOAT_ICON[category]}</span>
            <span>
              {listingTitle(current, t)} | {current.location} | {formatPriceLabel(current.priceLabel)}
            </span>
          </button>
        </div>
      </div>

      {safe.length > 1 && (
        <div className="ra-hero__dots" role="tablist" aria-label="Slideshow">
          {safe.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={`ra-dot ${i === index ? 'ra-dot--active' : ''}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
