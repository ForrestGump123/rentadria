import L from 'leaflet'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, Circle, useMap } from 'react-leaflet'
import { useTranslation } from 'react-i18next'
import { SEARCH_COUNTRY_IDS, type SearchCountryId } from '../../data/cities/countryIds'
import { loadCitiesForCountry } from '../../data/cities/loadCities'
import {
  EQUIPMENT_OPTS,
  FURNITURE_OPTS,
  HEATING_OPTS,
  RULES_OPTS,
} from '../../constants/accommodationFeatures'
import { LISTING_LANG_IDS, LISTING_LANG_LABELS, type ListingLangId } from '../../constants/ownerListingLangs'
import type { ListingCategory } from '../../types'
import type { OwnerProfile } from '../../utils/ownerSession'
import { geocodeCityLabel } from '../../utils/geocodeNominatim'
import { maxContactsForPlan } from '../../utils/planContactLimits'
import { translateListingFields } from '../../utils/ownerTranslate'
import { fileToWebpBlob, webpBlobToObjectUrl } from '../../utils/webpFromFile'
import { ContactPersonModal, type ContactDraft } from './ContactPersonModal'

const pinIcon = L.divIcon({
  className: 'ra-leaflet-pin',
  html: '<span aria-hidden="true">📍</span>',
  iconSize: [32, 36],
  iconAnchor: [16, 34],
})

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

function MapFlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, zoom)
  }, [center, zoom, map])
  return null
}

export type ContactRow = {
  id: string
  firstName: string
  lastName: string
  type: 'owner' | 'contact'
  phone: string
  email: string
  viber: string
  whatsapp: string
  telegram: string
  address: string
  categories: ListingCategory[]
}

type Props = {
  open: boolean
  onClose: () => void
  profile: OwnerProfile
}

type TabId = 'basic' | 'owners' | 'images' | 'export' | 'map'

export function AccommodationListingModal({ open, onClose, profile }: Props) {
  const { t } = useTranslation()
  const listId = useId()
  const [tab, setTab] = useState<TabId>('basic')

  const [receivedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [expiresAt] = useState(() => {
    const d = new Date()
    d.setFullYear(d.getFullYear() + 1)
    return d.toISOString().slice(0, 10)
  })

  const [activeLang, setActiveLang] = useState<ListingLangId>('cnr')
  const [titles, setTitles] = useState<Record<string, string>>(() =>
    Object.fromEntries(LISTING_LANG_IDS.map((l) => [l, ''])),
  )
  const [descriptions, setDescriptions] = useState<Record<string, string>>(() =>
    Object.fromEntries(LISTING_LANG_IDS.map((l) => [l, ''])),
  )
  const [translating, setTranslating] = useState(false)
  const titlesRef = useRef(titles)
  const descriptionsRef = useRef(descriptions)
  titlesRef.current = titles
  descriptionsRef.current = descriptions

  const [propertyType, setPropertyType] = useState('')
  const [structure, setStructure] = useState('')
  const [areaM2, setAreaM2] = useState('')
  const [floor, setFloor] = useState('')
  const [priceEur, setPriceEur] = useState('')
  const [pricePre, setPricePre] = useState('')
  const [priceSeason, setPriceSeason] = useState('')
  const [pricePost, setPricePost] = useState('')
  const [priceOff, setPriceOff] = useState('')
  const [furnished, setFurnished] = useState('')
  const [bathrooms, setBathrooms] = useState('')
  const [payCashCard, setPayCashCard] = useState(false)
  const [payCash, setPayCash] = useState(false)
  const [payCard, setPayCard] = useState(false)
  const [payBank, setPayBank] = useState(false)
  const [availableFrom, setAvailableFrom] = useState('')

  const [countryId, setCountryId] = useState<SearchCountryId | null>('me')
  const [city, setCity] = useState('')
  const [municipality, setMunicipality] = useState('')
  const [district, setDistrict] = useState('')
  const [street, setStreet] = useState('')
  const [streetNo, setStreetNo] = useState('')
  const [apt, setApt] = useState('')
  const [cities, setCities] = useState<string[]>([])
  const [citiesLoading, setCitiesLoading] = useState(false)
  const [cityOpen, setCityOpen] = useState(false)
  const cityWrapRef = useRef<HTMLDivElement>(null)

  const [featHeating, setFeatHeating] = useState<Set<string>>(new Set())
  const [featFurniture, setFeatFurniture] = useState<Set<string>>(new Set())
  const [featEquipment, setFeatEquipment] = useState<Set<string>>(new Set())
  const [featRules, setFeatRules] = useState<Set<string>>(new Set())

  const toggle = (set: Set<string>, id: string, on: boolean) => {
    const n = new Set(set)
    if (on) n.add(id)
    else n.delete(id)
    return n
  }

  const [contacts, setContacts] = useState<ContactRow[]>(() => [
    {
      id: 'owner-1',
      firstName: profile.displayName.split(/\s+/)[0] ?? '',
      lastName: profile.displayName.split(/\s+/).slice(1).join(' ') || '',
      type: 'owner',
      phone: '',
      email: profile.email,
      viber: '',
      whatsapp: '',
      telegram: '',
      address: '',
      categories: ['accommodation', 'car', 'motorcycle'],
    },
  ])
  const [contactVis, setContactVis] = useState<'both' | 'email' | 'phone'>('both')
  const [contactModalOpen, setContactModalOpen] = useState(false)
  const [contactEdit, setContactEdit] = useState<ContactDraft | null>(null)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)

  const [imageUrlsText, setImageUrlsText] = useState('')
  const [images, setImages] = useState<{ id: string; label: string }[]>([])

  const [exportIg, setExportIg] = useState(false)
  const [exportFb, setExportFb] = useState(false)

  const [mapLat, setMapLat] = useState<number | null>(42.4247)
  const [mapLng, setMapLng] = useState<number | null>(18.7712)
  const [mapPrecise, setMapPrecise] = useState(true)
  const [mapZoom] = useState(14)

  const maxContacts = maxContactsForPlan(profile.plan)
  const showContactCats = profile.plan === 'pro' || profile.plan === 'agency'

  useEffect(() => {
    if (!open) return
    setTab('basic')
  }, [open])

  useEffect(() => {
    if (!countryId) {
      setCities([])
      setCitiesLoading(false)
      return
    }
    let cancelled = false
    setCitiesLoading(true)
    loadCitiesForCountry(countryId)
      .then((list) => {
        if (!cancelled) {
          setCities(list)
          setCitiesLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCities([])
          setCitiesLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [countryId])

  useEffect(() => {
    if (!cityOpen) return
    const onDoc = (e: MouseEvent) => {
      if (cityWrapRef.current && !cityWrapRef.current.contains(e.target as Node)) setCityOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [cityOpen])

  const cityFiltered = useMemo(() => {
    const q = fold(city.trim())
    if (!q) return cities.slice(0, 80)
    return cities.filter((c) => fold(c).includes(q)).slice(0, 80)
  }, [cities, city])

  const runTranslate = useCallback(async () => {
    const src = activeLang
    const ti = titlesRef.current[src]?.trim() ?? ''
    const de = descriptionsRef.current[src]?.trim() ?? ''
    if (!ti && !de) return
    setTranslating(true)
    try {
      const targets = LISTING_LANG_IDS.filter((l) => l !== src)
      const { titles: tts, descriptions: dds } = await translateListingFields(src, ti, de, targets)
      setTitles((prev) => ({ ...prev, ...tts }))
      setDescriptions((prev) => ({ ...prev, ...dds }))
    } finally {
      setTranslating(false)
    }
  }, [activeLang])

  const onTitleBlur = () => {
    void runTranslate()
  }
  const onDescBlur = () => {
    void runTranslate()
  }

  const geocodeAndPin = useCallback(async () => {
    if (!countryId || !city.trim()) return
    const countryName = t(`search.country_${countryId}`)
    const q = `${city.trim()}, ${countryName}`
    const pos = await geocodeCityLabel(q)
    if (pos) {
      setMapLat(pos.lat)
      setMapLng(pos.lng)
    }
  }, [countryId, city, t])

  const center: [number, number] = useMemo(() => {
    const la = mapLat ?? 42.42
    const ln = mapLng ?? 18.77
    return [la, ln]
  }, [mapLat, mapLng])

  const addUrlsFromText = () => {
    const lines = imageUrlsText
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean)
    setImages((prev) => [
      ...prev,
      ...lines.map((url, i) => ({ id: `u-${Date.now()}-${i}`, label: url })),
    ])
    setImageUrlsText('')
  }

  const onPickFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const next: { id: string; label: string }[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      if (!f.type.startsWith('image/')) continue
      try {
        const blob = await fileToWebpBlob(f)
        const url = webpBlobToObjectUrl(blob)
        next.push({ id: `img-${Date.now()}-${i}`, label: url })
      } catch {
        /* ignore */
      }
    }
    setImages((p) => [...p, ...next])
  }

  const saveDraft = () => {
    const payload = {
      titles,
      descriptions,
      countryId,
      city,
      images: images.map((x) => x.label),
      exportIg,
      exportFb,
      lat: mapLat,
      lng: mapLng,
    }
    try {
      localStorage.setItem('rentadria_listing_draft_accommodation', JSON.stringify(payload))
    } catch {
      /* ignore */
    }
    window.alert(t('owner.listing.savedDraft'))
  }

  const validate = (): boolean => {
    const okTitle = LISTING_LANG_IDS.some((l) => titles[l]?.trim())
    const okDesc = LISTING_LANG_IDS.some((l) => descriptions[l]?.trim())
    if (!okTitle || !okDesc) {
      window.alert(t('owner.listing.errTitleDesc'))
      return false
    }
    if (!countryId || !city.trim()) {
      window.alert(t('owner.listing.errLocation'))
      return false
    }
    if (!payCashCard && !payCash && !payCard && !payBank) {
      window.alert(t('owner.listing.errPayment'))
      return false
    }
    if (!propertyType || !structure || !areaM2.trim() || !priceEur.trim()) {
      window.alert(t('owner.listing.errFields'))
      return false
    }
    if (images.length === 0) {
      window.alert(t('owner.listing.errImages'))
      return false
    }
    return true
  }

  if (!open) return null

  const tabOrder: TabId[] = ['basic', 'owners', 'images', 'export', 'map']
  const goNextTab = () => {
    const i = tabOrder.indexOf(tab)
    if (i < tabOrder.length - 1) setTab(tabOrder[i + 1]!)
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'basic', label: t('owner.listing.tabBasic') },
    { id: 'owners', label: t('owner.listing.tabOwners') },
    { id: 'images', label: t('owner.listing.tabImages') },
    { id: 'export', label: t('owner.listing.tabExport') },
    { id: 'map', label: t('owner.listing.tabMap') },
  ]

  return (
    <div className="ra-modal ra-modal--owner-listing" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="ra-modal__panel ra-owner-listing" onClick={(e) => e.stopPropagation()}>
        <header className="ra-owner-listing__head">
          <h2 id="owner-listing-title">{t('owner.listing.modalTitle')}</h2>
          <button type="button" className="ra-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <nav className="ra-owner-listing__tabs" role="tablist" aria-labelledby="owner-listing-title">
          {tabs.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={tab === x.id}
              className={`ra-owner-listing__tab ${tab === x.id ? 'is-active' : ''}`}
              onClick={() => setTab(x.id)}
            >
              {x.label}
            </button>
          ))}
        </nav>

        <div className="ra-owner-listing__body">
          {tab === 'basic' && (
            <div className="ra-owner-listing__basic">
              <div className="ra-owner-listing__cols">
                <div className="ra-owner-listing__col">
                  <p className="ra-owner-listing__note">{t('owner.listing.emailNotice')}</p>
                  <label className="ra-fld">
                    <span>{t('owner.listing.receivedAt')}</span>
                    <input readOnly value={receivedAt} />
                  </label>
                  <label className="ra-fld">
                    <span>{t('owner.listing.subExpires')}</span>
                    <input readOnly value={expiresAt} />
                  </label>
                </div>
                <div className="ra-owner-listing__col">
                  <p className="ra-owner-listing__req">{t('owner.listing.titleDescRequired')}</p>
                  <div className="ra-owner-listing__lang-btns">
                    {LISTING_LANG_IDS.map((l) => (
                      <button
                        key={l}
                        type="button"
                        className={`ra-owner-listing__lang-b ${activeLang === l ? 'is-active' : ''}`}
                        onClick={() => setActiveLang(l)}
                      >
                        {LISTING_LANG_LABELS[l]}
                      </button>
                    ))}
                  </div>
                  <label className="ra-fld">
                    <span>
                      {t('owner.listing.titleField')} <span className="ra-req">*</span>
                    </span>
                    <input
                      value={titles[activeLang] ?? ''}
                      onChange={(e) =>
                        setTitles((p) => ({ ...p, [activeLang]: e.target.value }))
                      }
                      onBlur={onTitleBlur}
                      placeholder={t('owner.listing.phTitle')}
                    />
                  </label>
                  <label className="ra-fld">
                    <span>
                      {t('owner.listing.descField')} <span className="ra-req">*</span>
                    </span>
                    <textarea
                      rows={6}
                      value={descriptions[activeLang] ?? ''}
                      onChange={(e) =>
                        setDescriptions((p) => ({ ...p, [activeLang]: e.target.value }))
                      }
                      onBlur={onDescBlur}
                      placeholder={t('owner.listing.phDesc')}
                    />
                    {translating && <span className="ra-owner-listing__translating">{t('owner.listing.translating')}</span>}
                  </label>
                </div>
              </div>

              <div className="ra-owner-listing__grid2">
                <label className="ra-fld">
                  <span>
                    {t('owner.listing.propertyType')} <span className="ra-req">*</span>
                  </span>
                  <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} required>
                    <option value="">—</option>
                    <option value="apartment">{t('owner.listing.pt.apartment')}</option>
                    <option value="house">{t('owner.listing.pt.house')}</option>
                    <option value="villa">{t('owner.listing.pt.villa')}</option>
                    <option value="studio">{t('owner.listing.pt.studio')}</option>
                  </select>
                </label>
                <label className="ra-fld">
                  <span>
                    {t('owner.listing.structure')} <span className="ra-req">*</span>
                  </span>
                  <select value={structure} onChange={(e) => setStructure(e.target.value)} required>
                    <option value="">—</option>
                    <option value="so2">{t('owner.listing.str.so2')}</option>
                    <option value="so3">{t('owner.listing.str.so3')}</option>
                    <option value="so4">{t('owner.listing.str.so4')}</option>
                  </select>
                </label>
                <label className="ra-fld">
                  <span>
                    {t('owner.listing.area')} <span className="ra-req">*</span>
                  </span>
                  <input value={areaM2} onChange={(e) => setAreaM2(e.target.value)} placeholder={t('owner.listing.phArea')} />
                </label>
                <label className="ra-fld">
                  <span>{t('owner.listing.floor')}</span>
                  <input value={floor} onChange={(e) => setFloor(e.target.value)} />
                </label>
                <label className="ra-fld">
                  <span>
                    {t('owner.listing.priceEur')} <span className="ra-req">*</span>
                  </span>
                  <input value={priceEur} onChange={(e) => setPriceEur(e.target.value)} placeholder={t('owner.listing.phPrice')} />
                </label>
              </div>

              <div className="ra-owner-listing__prices-center">
                <label className="ra-fld">
                  <span>{t('owner.listing.pricePre')}</span>
                  <input value={pricePre} onChange={(e) => setPricePre(e.target.value)} placeholder={t('owner.listing.phPre')} />
                </label>
                <label className="ra-fld">
                  <span>{t('owner.listing.priceIn')}</span>
                  <input value={priceSeason} onChange={(e) => setPriceSeason(e.target.value)} placeholder={t('owner.listing.phIn')} />
                </label>
                <label className="ra-fld">
                  <span>{t('owner.listing.pricePost')}</span>
                  <input value={pricePost} onChange={(e) => setPricePost(e.target.value)} placeholder={t('owner.listing.phPost')} />
                </label>
                <label className="ra-fld">
                  <span>{t('owner.listing.priceOff')}</span>
                  <input value={priceOff} onChange={(e) => setPriceOff(e.target.value)} placeholder={t('owner.listing.phOff')} />
                </label>
              </div>

              <div className="ra-owner-listing__grid2">
                <label className="ra-fld">
                  <span>{t('owner.listing.furnished')}</span>
                  <select value={furnished} onChange={(e) => setFurnished(e.target.value)}>
                    <option value="">—</option>
                    <option value="full">{t('owner.listing.furn.full')}</option>
                    <option value="partial">{t('owner.listing.furn.partial')}</option>
                    <option value="none">{t('owner.listing.furn.none')}</option>
                  </select>
                </label>
                <label className="ra-fld">
                  <span>{t('owner.listing.bathrooms')}</span>
                  <select value={bathrooms} onChange={(e) => setBathrooms(e.target.value)}>
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={String(n)}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <fieldset className="ra-owner-listing__pay">
                <legend>
                  {t('owner.listing.payment')} <span className="ra-req">*</span>
                </legend>
                <label>
                  <input type="checkbox" checked={payCashCard} onChange={(e) => setPayCashCard(e.target.checked)} />
                  {t('owner.listing.payCashCard')}
                </label>
                <label>
                  <input type="checkbox" checked={payCash} onChange={(e) => setPayCash(e.target.checked)} />
                  {t('owner.listing.payCash')}
                </label>
                <label>
                  <input type="checkbox" checked={payCard} onChange={(e) => setPayCard(e.target.checked)} />
                  {t('owner.listing.payCard')}
                </label>
                <label>
                  <input type="checkbox" checked={payBank} onChange={(e) => setPayBank(e.target.checked)} />
                  {t('owner.listing.payBank')}
                </label>
              </fieldset>

              <label className="ra-fld">
                <span>{t('owner.listing.availableFrom')}</span>
                <input type="date" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} />
              </label>

              <h3 className="ra-owner-listing__h3">{t('owner.listing.locationTitle')}</h3>
              <div className="ra-owner-listing__grid2">
                <label className="ra-fld">
                  <span>
                    {t('owner.listing.country')} <span className="ra-req">*</span>
                  </span>
                  <select
                    value={countryId ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      setCountryId(v === '' ? null : (v as SearchCountryId))
                      setCity('')
                    }}
                  >
                    <option value="">{t('search.countryAll')}</option>
                    {SEARCH_COUNTRY_IDS.map((id) => (
                      <option key={id} value={id}>
                        {t(`search.country_${id}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="ra-fld ra-owner-listing__combo" ref={cityWrapRef}>
                  <span>
                    {t('owner.listing.city')} <span className="ra-req">*</span>
                  </span>
                  <input
                    type="search"
                    placeholder={t('owner.listing.cityPh')}
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value)
                      setCityOpen(true)
                    }}
                    onFocus={() => setCityOpen(true)}
                    disabled={!countryId || citiesLoading}
                    aria-controls={`${listId}-city`}
                  />
                  {countryId && citiesLoading && <span className="ra-fld__hint">{t('search.citiesLoading')}</span>}
                  {countryId && !citiesLoading && cityOpen && cityFiltered.length > 0 && (
                    <ul id={`${listId}-city`} className="ra-search__suggest" role="listbox">
                      {cityFiltered.map((c) => (
                        <li key={c} role="option">
                          <button
                            type="button"
                            className="ra-search__suggest-btn"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setCity(c)
                              setCityOpen(false)
                              void geocodeAndPin()
                            }}
                          >
                            {c}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <label className="ra-fld">
                  <span>{t('owner.listing.municipality')}</span>
                  <input value={municipality} onChange={(e) => setMunicipality(e.target.value)} placeholder={t('owner.listing.cityPh')} />
                </label>
                <label className="ra-fld">
                  <span>{t('owner.listing.district')}</span>
                  <input value={district} onChange={(e) => setDistrict(e.target.value)} />
                </label>
                <label className="ra-fld">
                  <span>{t('owner.listing.street')}</span>
                  <input value={street} onChange={(e) => setStreet(e.target.value)} />
                </label>
                <label className="ra-fld">
                  <span>{t('owner.listing.streetNo')}</span>
                  <input value={streetNo} onChange={(e) => setStreetNo(e.target.value)} />
                </label>
                <label className="ra-fld">
                  <span>{t('owner.listing.apt')}</span>
                  <input value={apt} onChange={(e) => setApt(e.target.value)} />
                </label>
              </div>

              <div className="ra-owner-listing__feat">
                <h3 className="ra-owner-listing__h3">{t('owner.listing.featuresTitle')}</h3>
                <div className="ra-owner-listing__feat-cols">
                  <div>
                    <h4>{t('owner.listing.featHeating')}</h4>
                    {HEATING_OPTS.map((o) => (
                      <label key={o.id} className="ra-owner-listing__chk">
                        <input
                          type="checkbox"
                          checked={featHeating.has(o.id)}
                          onChange={(e) => setFeatHeating(toggle(featHeating, o.id, e.target.checked))}
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                  <div>
                    <h4>{t('owner.listing.featFurniture')}</h4>
                    {FURNITURE_OPTS.map((o) => (
                      <label key={o.id} className="ra-owner-listing__chk">
                        <input
                          type="checkbox"
                          checked={featFurniture.has(o.id)}
                          onChange={(e) => setFeatFurniture(toggle(featFurniture, o.id, e.target.checked))}
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                  <div>
                    <h4>{t('owner.listing.featEquipment')}</h4>
                    {EQUIPMENT_OPTS.map((o) => (
                      <label key={o.id} className="ra-owner-listing__chk">
                        <input
                          type="checkbox"
                          checked={featEquipment.has(o.id)}
                          onChange={(e) => setFeatEquipment(toggle(featEquipment, o.id, e.target.checked))}
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                  <div>
                    <h4>{t('owner.listing.featRules')}</h4>
                    {RULES_OPTS.map((o) => (
                      <label key={o.id} className="ra-owner-listing__chk">
                        <input
                          type="checkbox"
                          checked={featRules.has(o.id)}
                          onChange={(e) => setFeatRules(toggle(featRules, o.id, e.target.checked))}
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'owners' && (
            <div className="ra-owner-listing__owners">
              <p>
                <span className="ra-req">*</span> {t('owner.listing.ownersSection')}
              </p>
              <p className="ra-owner-listing__hint">{t('owner.listing.ownersHint')}</p>
              <div className="ra-owner-listing__vis">
                <span>{t('owner.listing.showVisitors')}</span>
                <label>
                  <input type="radio" name="vis" checked={contactVis === 'both'} onChange={() => setContactVis('both')} />
                  {t('owner.listing.visBoth')}
                </label>
                <label>
                  <input type="radio" name="vis" checked={contactVis === 'email'} onChange={() => setContactVis('email')} />
                  {t('owner.listing.visEmail')}
                </label>
                <label>
                  <input type="radio" name="vis" checked={contactVis === 'phone'} onChange={() => setContactVis('phone')} />
                  {t('owner.listing.visPhone')}
                </label>
              </div>
              <div className="ra-owner-listing__owner-actions">
                <button type="button" className="ra-btn ra-btn--ghost" disabled title={t('owner.soon')}>
                  {t('owner.listing.editMyData')}
                </button>
                <button
                  type="button"
                  className="ra-btn ra-btn--primary"
                  onClick={() => {
                    if (contacts.length >= maxContacts) {
                      window.alert(t('owner.listing.contactLimit', { max: maxContacts }))
                      return
                    }
                    setContactEdit(null)
                    setEditingContactId(null)
                    setContactModalOpen(true)
                  }}
                >
                  {t('owner.listing.addContact')}
                </button>
              </div>
              <div className="ra-owner-table-wrap">
                <table className="ra-owner-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>{t('owner.listing.contactFirst')}</th>
                      <th>{t('owner.listing.contactLast')}</th>
                      <th>{t('owner.listing.contactType')}</th>
                      <th>{t('owner.listing.contactPhone')}</th>
                      <th>{t('owner.listing.contactEmail')}</th>
                      <th>{t('owner.listing.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c, idx) => (
                      <tr key={c.id}>
                        <td>{idx + 1}</td>
                        <td>{c.firstName}</td>
                        <td>{c.lastName}</td>
                        <td>{c.type === 'owner' ? t('owner.listing.typeOwner') : t('owner.listing.typeContact')}</td>
                        <td>{c.phone}</td>
                        <td>{c.email}</td>
                        <td>
                          <button
                            type="button"
                            className="ra-btn ra-btn--ghost ra-btn--sm"
                            onClick={() => {
                              setEditingContactId(c.id)
                              setContactEdit({
                                firstName: c.firstName,
                                lastName: c.lastName,
                                phone: c.phone,
                                email: c.email,
                                viber: c.viber,
                                whatsapp: c.whatsapp,
                                telegram: c.telegram,
                                address: c.address,
                                categories: [...c.categories],
                              })
                              setContactModalOpen(true)
                            }}
                          >
                            {t('owner.listing.edit')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'images' && (
            <div className="ra-owner-listing__images">
              <p>
                <span className="ra-req">*</span> {t('owner.listing.imagesTitle')}
              </p>
              <p className="ra-owner-listing__hint">{t('owner.listing.imagesHint')}</p>
              <textarea
                className="ra-owner-listing__url-ta"
                rows={4}
                placeholder={t('owner.listing.imagesUrlPh')}
                value={imageUrlsText}
                onChange={(e) => setImageUrlsText(e.target.value)}
              />
              <button type="button" className="ra-btn ra-btn--primary" onClick={addUrlsFromText}>
                {t('owner.listing.addByUrl')}
              </button>
              <p className="ra-owner-listing__hint">{t('owner.listing.imagesOr')}</p>
              <label className="ra-btn ra-btn--primary ra-owner-listing__file">
                {t('owner.listing.addFile')}
                <input type="file" accept="image/*" multiple className="ra-sr-only" onChange={(e) => void onPickFiles(e.target.files)} />
              </label>
              <p className="ra-owner-listing__hint">{t('owner.listing.imagesDrag')}</p>
              <ul className="ra-owner-listing__thumbs">
                {images.map((im, i) => (
                  <li key={im.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', String(i))} onDragOver={(e) => e.preventDefault()} onDrop={(e) => {
                    e.preventDefault()
                    const from = Number(e.dataTransfer.getData('text/plain'))
                    if (Number.isNaN(from)) return
                    setImages((prev) => {
                      const n = [...prev]
                      const [item] = n.splice(from, 1)
                      n.splice(i, 0, item)
                      return n
                    })
                  }}>
                    <img src={im.label} alt="" />
                    <button type="button" className="ra-owner-listing__thumb-x" onClick={() => setImages((p) => p.filter((x) => x.id !== im.id))}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === 'export' && (
            <div className="ra-owner-listing__export">
              <fieldset>
                <legend>{t('owner.listing.exportLegend')}</legend>
                <label>
                  <input type="checkbox" checked={exportIg} onChange={(e) => setExportIg(e.target.checked)} />
                  Instagram
                </label>
                <label>
                  <input type="checkbox" checked={exportFb} onChange={(e) => setExportFb(e.target.checked)} />
                  Facebook
                </label>
              </fieldset>
              <p className="ra-owner-listing__note">{t('owner.listing.exportNote1')}</p>
              <p className="ra-owner-listing__hint">{t('owner.listing.exportNote2')}</p>
            </div>
          )}

          {tab === 'map' && (
            <div className="ra-owner-listing__maptab">
              <p className="ra-owner-listing__hint">{t('owner.listing.mapHint')}</p>
              {mapLat != null && mapLng != null ? (
                <MapContainer center={center} zoom={mapZoom} className="ra-owner-map-picker" scrollWheelZoom>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                  <MapFlyTo center={center} zoom={mapZoom} />
                  {!mapPrecise && <Circle center={center} radius={300} pathOptions={{ color: '#38bdf8', fillOpacity: 0.12 }} />}
                  <Marker
                    position={[mapLat, mapLng]}
                    icon={pinIcon}
                    draggable
                    eventHandlers={{
                      dragend: (e) => {
                        const p = e.target.getLatLng()
                        setMapLat(p.lat)
                        setMapLng(p.lng)
                      },
                    }}
                  />
                </MapContainer>
              ) : (
                <p className="ra-owner-listing__hint">{t('owner.listing.mapNoMarker')}</p>
              )}
              <div className="ra-owner-listing__map-tools">
                <label className="ra-fld">
                  <span>Lat</span>
                  <input
                    value={mapLat ?? ''}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      setMapLat(Number.isNaN(v) ? null : v)
                    }}
                  />
                </label>
                <label className="ra-fld">
                  <span>Lng</span>
                  <input
                    value={mapLng ?? ''}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      setMapLng(Number.isNaN(v) ? null : v)
                    }}
                  />
                </label>
                <label>
                  <input type="radio" name="prec" checked={mapPrecise} onChange={() => setMapPrecise(true)} />
                  {t('owner.listing.mapPrecise')}
                </label>
                <label>
                  <input type="radio" name="prec" checked={!mapPrecise} onChange={() => setMapPrecise(false)} />
                  {t('owner.listing.mapApprox')}
                </label>
                <button
                  type="button"
                  className="ra-btn ra-btn--ghost"
                  onClick={() => {
                    setMapLat(null)
                    setMapLng(null)
                  }}
                >
                  {t('owner.listing.removeMarker')}
                </button>
                <button type="button" className="ra-btn ra-btn--ghost" onClick={() => void geocodeAndPin()}>
                  {t('owner.listing.centerOnCity')}
                </button>
                <a
                  className="ra-link-btn"
                  href={mapLat != null && mapLng != null ? `https://www.google.com/maps?q=${mapLat},${mapLng}` : '#'}
                  target="_blank"
                  rel="noreferrer"
                >
                  Google Maps →
                </a>
              </div>
            </div>
          )}
        </div>

        <footer className="ra-owner-listing__foot">
          <button type="button" className="ra-link-btn" onClick={() => window.alert(t('owner.soon'))}>
            {t('owner.listing.help')}
          </button>
          <div className="ra-owner-listing__foot-btns">
            <button type="button" className="ra-btn ra-btn--primary" onClick={goNextTab}>
              {t('owner.listing.next')}
            </button>
            <button
              type="button"
              className="ra-btn ra-btn--primary"
              onClick={() => {
                if (validate()) saveDraft()
              }}
            >
              {t('owner.listing.save')}
            </button>
            <button type="button" className="ra-btn ra-btn--ghost" onClick={onClose}>
              {t('owner.listing.cancel')}
            </button>
          </div>
        </footer>
      </div>

      <ContactPersonModal
        open={contactModalOpen}
        initial={contactEdit}
        showCategoryCheckboxes={showContactCats}
        onClose={() => {
          setContactModalOpen(false)
          setContactEdit(null)
          setEditingContactId(null)
        }}
        onSave={(d) => {
          if (editingContactId) {
            setContacts((prev) =>
              prev.map((c) =>
                c.id === editingContactId
                  ? {
                      ...c,
                      firstName: d.firstName,
                      lastName: d.lastName,
                      phone: d.phone,
                      email: d.email,
                      viber: d.viber,
                      whatsapp: d.whatsapp,
                      telegram: d.telegram,
                      address: d.address,
                      categories: d.categories,
                    }
                  : c,
              ),
            )
          } else {
            setContacts((prev) => [
              ...prev,
              {
                id: `c-${Date.now()}`,
                firstName: d.firstName,
                lastName: d.lastName,
                type: 'contact',
                phone: d.phone,
                email: d.email,
                viber: d.viber,
                whatsapp: d.whatsapp,
                telegram: d.telegram,
                address: d.address,
                categories: d.categories,
              },
            ])
          }
        }}
      />
    </div>
  )
}
