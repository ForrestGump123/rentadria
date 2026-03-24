import { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Listing, ListingCategory } from '../types'
import type { SearchCountryId } from '../data/cities/countryIds'
import { loadCitiesForCountry } from '../data/cities/loadCities'
import { listingsByCategory } from '../data/listings'
import { filterListingsByLocation } from '../utils/locationFilter'
import { Header } from '../components/Header'
import { HeroSlideshow } from '../components/HeroSlideshow'
import { SideAdsColumn } from '../components/SideAdsColumn'
import { FeaturedMarquee } from '../components/FeaturedMarquee'
import { AdGrid } from '../components/AdGrid'
import { Footer } from '../components/Footer'
import { listingImageUrl } from '../utils/imageUrl'
import type { SubscriptionPlan } from '../types/plan'
import { isSubscriptionPlan } from '../types/plan'

const CAT: ListingCategory[] = ['accommodation', 'car', 'motorcycle']

const PENDING_PLAN_KEY = 'rentadria_pending_plan'

export function HomePage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [category, setCategory] = useState<ListingCategory>(() => {
    const c = searchParams.get('cat') as ListingCategory | null
    return c && CAT.includes(c) ? c : 'accommodation'
  })
  const [page, setPage] = useState(1)
  const [registrationIntent, setRegistrationIntent] = useState<{
    plan: SubscriptionPlan | null
  } | null>(null)

  const [draftCountry, setDraftCountry] = useState<SearchCountryId | null>(null)
  const [draftCity, setDraftCity] = useState('')
  const [appliedCountry, setAppliedCountry] = useState<SearchCountryId | null>(null)
  const [appliedCity, setAppliedCity] = useState('')

  const [citiesDraft, setCitiesDraft] = useState<string[]>([])
  const [citiesDraftLoading, setCitiesDraftLoading] = useState(false)
  const [citiesApplied, setCitiesApplied] = useState<string[]>([])
  const [citiesAppliedLoading, setCitiesAppliedLoading] = useState(false)

  useEffect(() => {
    if (!draftCountry) {
      setCitiesDraft([])
      setCitiesDraftLoading(false)
      return
    }
    let cancelled = false
    setCitiesDraftLoading(true)
    loadCitiesForCountry(draftCountry)
      .then((list) => {
        if (!cancelled) {
          setCitiesDraft(list)
          setCitiesDraftLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCitiesDraft([])
          setCitiesDraftLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [draftCountry])

  useEffect(() => {
    if (!appliedCountry) {
      setCitiesApplied([])
      setCitiesAppliedLoading(false)
      return
    }
    let cancelled = false
    setCitiesAppliedLoading(true)
    loadCitiesForCountry(appliedCountry)
      .then((list) => {
        if (!cancelled) {
          setCitiesApplied(list)
          setCitiesAppliedLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCitiesApplied([])
          setCitiesAppliedLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [appliedCountry])

  const baseList = useMemo(() => listingsByCategory(category), [category])

  const citiesReady = !appliedCountry || !citiesAppliedLoading

  const gridItems = useMemo(
    () =>
      filterListingsByLocation(
        baseList,
        appliedCountry,
        appliedCity || null,
        citiesApplied.length ? citiesApplied : null,
        citiesReady,
      ),
    [baseList, appliedCountry, appliedCity, citiesApplied, citiesReady],
  )

  const slides = useMemo(() => gridItems.slice(0, 8), [gridItems])

  const featured = useMemo(() => {
    const list = gridItems
    const feat = list.filter((l) => l.featured)
    const rest = list.filter((l) => !l.featured)
    return [...feat, ...rest].slice(0, 24)
  }, [gridItems])

  const sideLeft = useMemo(() => gridItems, [gridItems])
  const sideRight = useMemo(() => [...gridItems].reverse(), [gridItems])

  const ogImage = useMemo(() => {
    const first = slides[0]?.image
    return first ? listingImageUrl(first) : ''
  }, [slides])

  useEffect(() => {
    document.documentElement.lang = i18n.language.split('-')[0]
  }, [i18n.language])

  useEffect(() => {
    const c = searchParams.get('cat') as ListingCategory | null
    if (c && CAT.includes(c)) setCategory(c)
  }, [searchParams])

  useEffect(() => {
    if (searchParams.get('register') !== '1') return
    try {
      const raw = sessionStorage.getItem(PENDING_PLAN_KEY)
      const plan = isSubscriptionPlan(raw) ? raw : null
      setRegistrationIntent({ plan })
      sessionStorage.removeItem(PENDING_PLAN_KEY)
    } catch {
      setRegistrationIntent({ plan: null })
    }
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      n.delete('register')
      return n
    })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    setPage(1)
  }, [category])

  useEffect(() => {
    const max = Math.max(1, Math.ceil(gridItems.length / 20))
    if (page > max) setPage(max)
  }, [gridItems.length, page])

  const onConsumedRegistrationIntent = useCallback(() => {
    setRegistrationIntent(null)
  }, [])

  const openListing = useCallback(
    (listing: Listing) => {
      void navigate(`/listing/${listing.id}`)
    },
    [navigate],
  )

  const onCategory = useCallback(
    (c: ListingCategory) => {
      setCategory(c)
      setSearchParams({ cat: c })
    },
    [setSearchParams],
  )

  const onSearchSubmit = useCallback(() => {
    setAppliedCountry(draftCountry)
    setAppliedCity(draftCity.trim())
    setPage(1)
  }, [draftCountry, draftCity])

  return (
    <div className="ra-app">
      <Helmet>
        <title>{t('home.title')}</title>
        <meta name="description" content={t('home.ogDescription')} />
        <meta property="og:title" content={t('home.title')} />
        <meta property="og:description" content={t('home.ogDescription')} />
        {ogImage ? <meta property="og:image" content={ogImage} /> : null}
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        {ogImage ? <meta name="twitter:image" content={ogImage} /> : null}
      </Helmet>
      <Header
        category={category}
        onCategory={onCategory}
        registrationIntent={registrationIntent}
        onConsumedRegistrationIntent={onConsumedRegistrationIntent}
      />

      <main className="ra-main">
        <div className="ra-row">
          <SideAdsColumn side="left" items={sideLeft} onOpenListing={openListing} />
          <div className="ra-center">
            <HeroSlideshow
              key={category}
              category={category}
              slides={slides}
              onOpenListing={openListing}
              searchCountryId={draftCountry}
              onSearchCountryId={setDraftCountry}
              searchCity={draftCity}
              onSearchCity={setDraftCity}
              cities={citiesDraft}
              citiesLoading={citiesDraftLoading}
              onSearchSubmit={onSearchSubmit}
            />
          </div>
          <SideAdsColumn side="right" items={sideRight} onOpenListing={openListing} />
        </div>

        <div className="ra-below">
          <FeaturedMarquee items={featured} onOpenListing={openListing} />
          <AdGrid items={gridItems} page={page} onPage={setPage} onOpenListing={openListing} />
        </div>
      </main>

      <Footer />
    </div>
  )
}
