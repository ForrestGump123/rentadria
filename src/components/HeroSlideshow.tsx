import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LISTING_IMAGE_FALLBACK } from '../data/listings'
import type { Listing, ListingCategory } from '../types'
import type { SearchCountryId } from '../data/cities/countryIds'
import { useCurrency } from '../context/CurrencyContext'
import { listingImageUrl } from '../utils/imageUrl'
import { listingTitle } from '../utils/listingTitle'
import { getPublicSiteListingCounts } from '../utils/publicSiteStats'
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
  searchPropertyType: string
  onSearchPropertyType: (v: string) => void
  searchVehicleMake: string
  onSearchVehicleMake: (v: string) => void
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
  searchPropertyType,
  onSearchPropertyType,
  searchVehicleMake,
  onSearchVehicleMake,
}: HeroSlideshowProps) {
  const { t, i18n } = useTranslation()
  const { formatPriceLabel } = useCurrency()
  const [index, setIndex] = useState(0)
  const [heroSrc, setHeroSrc] = useState<string>('')
  const [listingStats, setListingStats] = useState(() => getPublicSiteListingCounts())
  const fmtCount = useMemo(
    () => (n: number) => n.toLocaleString(i18n.language.replace('_', '-')),
    [i18n.language],
  )

  useEffect(() => {
    const bump = () => setListingStats(getPublicSiteListingCounts())
    bump()
    window.addEventListener('rentadria-owner-listings-updated', bump)
    window.addEventListener('storage', bump)
    return () => {
      window.removeEventListener('rentadria-owner-listings-updated', bump)
      window.removeEventListener('storage', bump)
    }
  }, [])
  const safe = slides.length > 0 ? slides : []
  const current = safe.length ? safe[index % safe.length] : undefined
  const h = `hero.${category}` as const

  const currentSrc = current ? listingImageUrl(current.image) : ''
  const displayedSrc = heroSrc || currentSrc

  useEffect(() => {
    if (safe.length <= 1) return
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % safe.length)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [safe.length, intervalMs])

  useEffect(() => {
    const tid = setTimeout(() => {
      setIndex(0)
      setHeroSrc('')
    }, 0)
    return () => clearTimeout(tid)
  }, [slides, category])

  if (!current) {
    return (
      <section className="ra-hero">
        <div className="ra-hero__media ra-hero__media--empty">
          <div className="ra-hero__media-visual" aria-hidden>
            <div className="ra-hero__overlay" />
          </div>
          <div className="ra-hero__content">
            <p className="ra-hero__badge">{t(`${h}.badge`)}</p>
            <h1 className="ra-hero__title">
              {t(`${h}.titleBefore`)}{' '}
              <span className="ra-hero__title-accent">{t(`${h}.titleHighlight`)}</span>
            </h1>
            <p className="ra-hero__subtitle">{t(`${h}.subtitle`)}</p>
            <HeroSearchBar
              category={category}
              countryId={searchCountryId}
              onCountryId={onSearchCountryId}
              city={searchCity}
              onCity={onSearchCity}
              cities={cities}
              citiesLoading={citiesLoading}
              onSubmit={onSearchSubmit}
              propertyType={searchPropertyType}
              onPropertyType={onSearchPropertyType}
              vehicleMake={searchVehicleMake}
              onVehicleMake={onSearchVehicleMake}
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
        <div className="ra-hero__media-visual" aria-hidden>
          <img
            src={displayedSrc}
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
        </div>
        <div className="ra-hero__content">
          <p className="ra-hero__badge">{t(`${h}.badge`)}</p>
          <h1 className="ra-hero__title">
            {t(`${h}.titleBefore`)}{' '}
            <span className="ra-hero__title-accent">{t(`${h}.titleHighlight`)}</span>
          </h1>
          <p className="ra-hero__subtitle">{t(`${h}.subtitle`)}</p>

          <HeroSearchBar
            category={category}
            countryId={searchCountryId}
            onCountryId={onSearchCountryId}
            city={searchCity}
            onCity={onSearchCity}
            cities={cities}
            citiesLoading={citiesLoading}
            onSubmit={onSearchSubmit}
            propertyType={searchPropertyType}
            onPropertyType={onSearchPropertyType}
            vehicleMake={searchVehicleMake}
            onVehicleMake={onSearchVehicleMake}
          />

          <button
            type="button"
            className="ra-hero__current-listing"
            onClick={() => onOpenListing(current)}
          >
            <span className="ra-hero__current-listing__icon" aria-hidden>
              {FLOAT_ICON[category]}
            </span>
            <span className="ra-hero__current-listing__main">
              <span className="ra-hero__current-listing__title">
                {listingTitle(current, t)}
              </span>
              <span className="ra-hero__current-listing__loc">{current.location}</span>
            </span>
            <span className="ra-hero__current-listing__price">
              {formatPriceLabel(current.priceLabel)}
            </span>
          </button>

          <div className="ra-stats">
            <div>
              <strong>{fmtCount(listingStats.accommodations)}</strong>
              <span>{t('stats.accommodations')}</span>
            </div>
            <div>
              <strong>{fmtCount(listingStats.cars)}</strong>
              <span>{t('stats.cars')}</span>
            </div>
            <div>
              <strong>{fmtCount(listingStats.motorcycles)}</strong>
              <span>{t('stats.motorcycles')}</span>
            </div>
            <div>
              <strong>{fmtCount(listingStats.countries)}</strong>
              <span>{t('stats.countries')}</span>
            </div>
          </div>
        </div>
      </div>

      {safe.length > 1 ? (
        <>
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
          <p className="ra-hero__slideshow-hint" role="note">
            {t('hero.slideshowHintMob')}
          </p>
        </>
      ) : null}
    </section>
  )
}
