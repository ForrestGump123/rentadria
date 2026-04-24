import { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Listing, ListingCategory } from '../types'
import type { SearchCountryId } from '../data/cities/countryIds'
import { loadAllCitiesMerged, loadCitiesForCountry } from '../data/cities/loadCities'
import { listingsByCategoryMerged } from '../data/listings'
import { filterHomeListings } from '../utils/locationFilter'
import { filterListingsBySearchFacets } from '../utils/searchFacets'
import { Header } from '../components/Header'
import { HeroSlideshow } from '../components/HeroSlideshow'
import { EntryPopupBanner } from '../components/EntryPopupBanner'
import { SideAdsColumn } from '../components/SideAdsColumn'
import { FeaturedMarquee } from '../components/FeaturedMarquee'
import { MobileSidePromoStrip } from '../components/MobileSidePromoStrip'
import { AdGrid } from '../components/AdGrid'
import { Footer } from '../components/Footer'
import { listingImageUrl } from '../utils/imageUrl'
import { adminBannersToListings, isAdminPromoListingId } from '../utils/adminBannerListings'
import { listBannersForSlot } from '../utils/adminBannersStore'
import { mergePromotedFirst, getPromotedListingsForPlacement } from '../utils/ownerAds'
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
  const [adsEpoch, setAdsEpoch] = useState(0)
  const [bannerEpoch, setBannerEpoch] = useState(0)
  const [registrationIntent, setRegistrationIntent] = useState<{
    plan: SubscriptionPlan | null
  } | null>(null)

  const [draftCountry, setDraftCountry] = useState<SearchCountryId | null>(null)
  const [draftCity, setDraftCity] = useState('')
  const [appliedCountry, setAppliedCountry] = useState<SearchCountryId | null>(null)
  const [appliedCity, setAppliedCity] = useState('')
  const [draftPropertyType, setDraftPropertyType] = useState('')
  const [appliedPropertyType, setAppliedPropertyType] = useState('')
  const [draftVehicleMake, setDraftVehicleMake] = useState('')
  const [appliedVehicleMake, setAppliedVehicleMake] = useState('')

  const [citiesDraft, setCitiesDraft] = useState<string[]>([])
  const [citiesDraftLoading, setCitiesDraftLoading] = useState(false)
  const [citiesApplied, setCitiesApplied] = useState<string[]>([])
  const [citiesAppliedLoading, setCitiesAppliedLoading] = useState(false)

  useEffect(() => {
    if (!draftCountry) {
      let cancelled = false
      const tid = setTimeout(() => setCitiesDraftLoading(true), 0)
      loadAllCitiesMerged()
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
        clearTimeout(tid)
      }
    }
    let cancelled = false
    const tid = setTimeout(() => setCitiesDraftLoading(true), 0)
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
      clearTimeout(tid)
    }
  }, [draftCountry])

  useEffect(() => {
    if (!appliedCountry) {
      const tid = setTimeout(() => {
        setCitiesApplied([])
        setCitiesAppliedLoading(false)
      }, 0)
      return () => clearTimeout(tid)
    }
    let cancelled = false
    const tid = setTimeout(() => setCitiesAppliedLoading(true), 0)
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
      clearTimeout(tid)
    }
  }, [appliedCountry])

  const baseList = useMemo(() => listingsByCategoryMerged(category), [category])

  const citiesReady = !appliedCountry || !citiesAppliedLoading

  const gridItems = useMemo(() => {
    const locFiltered = filterHomeListings(
      baseList,
      appliedCountry,
      appliedCity,
      citiesApplied.length ? citiesApplied : null,
      citiesReady,
    )
    return filterListingsBySearchFacets(
      locFiltered,
      category,
      category === 'accommodation' ? appliedPropertyType : '',
      category === 'car' || category === 'motorcycle' ? appliedVehicleMake : '',
    )
  }, [
    baseList,
    appliedCountry,
    appliedCity,
    citiesApplied,
    citiesReady,
    category,
    appliedPropertyType,
    appliedVehicleMake,
  ])

  const hasActiveSearch = useMemo(
    () =>
      Boolean(
        appliedCountry ||
          appliedCity.trim() ||
          appliedPropertyType.trim() ||
          appliedVehicleMake.trim(),
      ),
    [appliedCountry, appliedCity, appliedPropertyType, appliedVehicleMake],
  )

  const gridIdSet = useMemo(() => new Set(gridItems.map((l) => l.id)), [gridItems])

  const promoSlides = useMemo(() => {
    void adsEpoch
    return getPromotedListingsForPlacement(category, 'slideshow')
  }, [category, adsEpoch])
  const promoFeatured = useMemo(() => {
    void adsEpoch
    return getPromotedListingsForPlacement(category, 'featured')
  }, [category, adsEpoch])
  const promoSide = useMemo(() => {
    void adsEpoch
    return getPromotedListingsForPlacement(category, 'sideSlideshow')
  }, [category, adsEpoch])

  const promoSlidesScoped = useMemo(
    () => (hasActiveSearch ? promoSlides.filter((l) => gridIdSet.has(l.id)) : promoSlides),
    [hasActiveSearch, promoSlides, gridIdSet],
  )
  const promoFeaturedScoped = useMemo(
    () => (hasActiveSearch ? promoFeatured.filter((l) => gridIdSet.has(l.id)) : promoFeatured),
    [hasActiveSearch, promoFeatured, gridIdSet],
  )
  const promoSideScoped = useMemo(
    () => (hasActiveSearch ? promoSide.filter((l) => gridIdSet.has(l.id)) : promoSide),
    [hasActiveSearch, promoSide, gridIdSet],
  )

  const adminSlideshow = useMemo(() => {
    void bannerEpoch
    return adminBannersToListings(listBannersForSlot('slideshow', appliedCountry), category)
  }, [bannerEpoch, appliedCountry, category])

  const adminSideLeft = useMemo(() => {
    void bannerEpoch
    return adminBannersToListings(listBannersForSlot('left', appliedCountry), category)
  }, [bannerEpoch, appliedCountry, category])

  const adminSideRight = useMemo(() => {
    void bannerEpoch
    return adminBannersToListings(listBannersForSlot('right', appliedCountry), category)
  }, [bannerEpoch, appliedCountry, category])

  const slides = useMemo(
    () => mergePromotedFirst(adminSlideshow, mergePromotedFirst(promoSlidesScoped, gridItems, 8), 8),
    [adminSlideshow, gridItems, promoSlidesScoped],
  )

  const featured = useMemo(() => {
    const list = gridItems
    const feat = list.filter((l) => l.featured)
    const rest = list.filter((l) => !l.featured)
    const ordered = [...feat, ...rest]
    return mergePromotedFirst(promoFeaturedScoped, ordered, 24)
  }, [gridItems, promoFeaturedScoped])

  const sideLeft = useMemo(
    () => mergePromotedFirst(adminSideLeft, mergePromotedFirst(promoSideScoped, gridItems)),
    [adminSideLeft, gridItems, promoSideScoped],
  )
  const sideRight = useMemo(
    () => mergePromotedFirst(adminSideRight, mergePromotedFirst(promoSideScoped, [...gridItems].reverse())),
    [adminSideRight, gridItems, promoSideScoped],
  )

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
    const bump = () => setAdsEpoch((e) => e + 1)
    window.addEventListener('rentadria-owner-ads-updated', bump)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'rentadria_owner_ad_bookings_v1') bump()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('rentadria-owner-ads-updated', bump)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    const bump = () => setBannerEpoch((e) => e + 1)
    window.addEventListener('rentadria-admin-banners-updated', bump)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'rentadria_admin_banners_v1') bump()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('rentadria-admin-banners-updated', bump)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    setDraftPropertyType('')
    setAppliedPropertyType('')
    setDraftVehicleMake('')
    setAppliedVehicleMake('')
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
      if (isAdminPromoListingId(listing.id)) return
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
    setAppliedPropertyType(draftPropertyType.trim())
    setAppliedVehicleMake(draftVehicleMake.trim())
    setPage(1)
    requestAnimationFrame(() => {
      document.getElementById('home-search-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [draftCountry, draftCity, draftPropertyType, draftVehicleMake])

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

      <EntryPopupBanner searchCountryId={appliedCountry} epoch={bannerEpoch} />

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
              searchPropertyType={draftPropertyType}
              onSearchPropertyType={(v) => {
                setDraftPropertyType(v)
                setAppliedPropertyType(v)
              }}
              searchVehicleMake={draftVehicleMake}
              onSearchVehicleMake={(v) => {
                setDraftVehicleMake(v)
                setAppliedVehicleMake(v)
              }}
            />
          </div>
          <SideAdsColumn side="right" items={sideRight} onOpenListing={openListing} />
        </div>

        <MobileSidePromoStrip
          sideLeft={sideLeft}
          sideRight={sideRight}
          onOpenListing={openListing}
        />

        <div className="ra-below">
          <section className="ra-home-featured-strip" aria-label={t('search.featuredStripAria')}>
            <FeaturedMarquee items={featured} onOpenListing={openListing} />
          </section>
          <AdGrid items={gridItems} page={page} onPage={setPage} onOpenListing={openListing} />
        </div>
      </main>

      <Footer />
    </div>
  )
}
