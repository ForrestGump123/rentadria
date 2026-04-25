import L from 'leaflet'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { MapContainer, Marker, TileLayer, Circle, useMap } from 'react-leaflet'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { SEARCH_COUNTRY_IDS, type SearchCountryId } from '../../data/cities/countryIds'
import { loadCitiesForCountry } from '../../data/cities/loadCities'
import {
  EQUIPMENT_OPTS,
  FURNITURE_OPTS,
  HEATING_OPTS,
  RULES_OPTS,
} from '../../constants/accommodationFeatures'
import {
  defaultCarListingExtras,
  normalizeCarListingExtras,
  type CarExtraMoney,
  type CarListingExtras,
} from '../../constants/carListingExtras'
import {
  defaultMotorcycleListingExtras,
  normalizeMotorcycleListingExtras,
  type MotoExtraMoney,
  type MotorcycleListingExtras,
} from '../../constants/motorcycleListingExtras'
import { LISTING_LANG_IDS, LISTING_LANG_LABELS, type ListingLangId } from '../../constants/ownerListingLangs'
import type { ListingCategory } from '../../types'
import {
  maxListingsForOwnerCategory,
  upsertOwnerAccommodationListingRow,
  upsertOwnerCarListingRow,
  upsertOwnerMotorcycleListingRow,
  type OwnerProfile,
} from '../../utils/ownerSession'
import { geocodeCityLabel } from '../../utils/geocodeNominatim'
import { maxContactsForPlan } from '../../utils/planContactLimits'
import { VEHICLE_MAKES, vehicleModelsForMake } from '../../data/vehicleCatalog'
import { MOTORCYCLE_MAKES, motorcycleModelsForMake } from '../../data/motorcycleCatalog'
import {
  ACCOMMODATION_DRAFT_LS_KEY,
  CAR_DRAFT_LS_KEY,
  MOTO_DRAFT_LS_KEY,
  ownerAccommodationPublicListingId,
  ownerCarPublicListingId,
  ownerMotorcyclePublicListingId,
  type AccommodationListingDraft,
} from '../../utils/accommodationDraft'
import { syncContactAvatarGlobals } from '../../utils/contactAvatarGlobal'
import { enqueueListingSocial } from '../../utils/socialEnqueue'
import { isAdminSession } from '../../utils/adminSession'
import { fetchDraft, saveDraft } from '../../lib/listingDraftApi'
import { setListingInquiryNotifyEmail } from '../../utils/visitorInquiries'
import { formatDateDayMonthYear } from '../../utils/dateDisplay'
import { subscriptionValidUntilYmd } from '../../utils/registrationPromo'
import { translateListingFields } from '../../utils/ownerTranslate'
import { fileToResizedJpegDataUrl } from '../../utils/imageDataUrl'
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

function asListingCategoryArray(raw: unknown): ListingCategory[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is ListingCategory => x === 'accommodation' || x === 'car' || x === 'motorcycle')
}

function contactRowAvatarSrc(c: { avatarUrl?: string | null; avatarDataUrl?: string | null }): string {
  return (c.avatarUrl?.trim() || c.avatarDataUrl?.trim() || '').trim()
}

function MapFlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, zoom)
  }, [center, zoom, map])
  return null
}

/** Where this row’s phone may be shown for published listings */
export type ContactPhoneScope = 'this_listing' | 'all_listings'

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
  phoneScope: ContactPhoneScope
  /** Slika za ovaj kontakt (ne za red „Vlasnik“ — koristi se profil). */
  avatarDataUrl?: string | null
  /** Javni URL nakon uploada (Supabase `owner-avatars`). */
  avatarUrl?: string | null
  /** Vlasnik: profilna slika na svim oglasima; kontakt: ista slika na svim oglasima (globalno). */
  showAvatarOnAllListings?: boolean
}

function publicListingIdForSavedRow(
  formCategory: 'accommodation' | 'car' | 'motorcycle',
  rowId: string,
): string {
  if (formCategory === 'car') return ownerCarPublicListingId(rowId)
  if (formCategory === 'motorcycle') return ownerMotorcyclePublicListingId(rowId)
  return ownerAccommodationPublicListingId(rowId)
}

function localDraftKeyForRow(
  formCategory: 'accommodation' | 'car' | 'motorcycle',
  rowId: string,
): string {
  if (formCategory === 'car') return `${CAR_DRAFT_LS_KEY}::${rowId}`
  if (formCategory === 'motorcycle') return `${MOTO_DRAFT_LS_KEY}::${rowId}`
  return `${ACCOMMODATION_DRAFT_LS_KEY}::${rowId}`
}

function saveDraftLocally(
  formCategory: 'accommodation' | 'car' | 'motorcycle',
  rowId: string,
  draft: AccommodationListingDraft,
): void {
  try {
    const json = JSON.stringify(draft)
    localStorage.setItem(localDraftKeyForRow(formCategory, rowId), json)
    if (formCategory === 'accommodation') {
      localStorage.setItem(ACCOMMODATION_DRAFT_LS_KEY, json)
    }
  } catch {
    /* ignore */
  }
}

function deriveNotifyEmail(contacts: ContactRow[], profileEmail: string): string {
  const owner = contacts.find((c) => c.type === 'owner' && c.email.trim())
  if (owner) return owner.email.trim()
  const any = contacts.find((c) => c.email.trim())
  if (any) return any.email.trim()
  return profileEmail.trim()
}

type CarMoneyKey = Exclude<keyof CarListingExtras, 'dailyKmLimit' | 'airConditioning'>

type MotoMoneyKey = keyof Pick<
  MotorcycleListingExtras,
  | 'driverHelmet'
  | 'passengerHelmet'
  | 'padlock'
  | 'topCase'
  | 'navigation'
  | 'phoneHolder'
  | 'hotelDelivery'
  | 'airportDelivery'
  | 'officeTransfer'
  | 'dropOff'
  | 'otherCityDelivery'
>

type Props = {
  open: boolean
  onClose: () => void
  profile: OwnerProfile
  formCategory: 'accommodation' | 'car' | 'motorcycle'
  /** After a successful save (draft + dashboard row); list refresh */
  onSaved?: () => void
  /** Red u tablici „Moji oglasi“ kad se otvara „Izmijeni“. */
  editingOwnerRowId?: string | null
}

type SearchableComboProps = {
  label: ReactNode
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  required?: boolean
  disabled?: boolean
  inputId: string
  listId: string
}

function SearchableCombo({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  disabled,
  inputId,
  listId,
}: SearchableComboProps) {
  const [suggestOpen, setSuggestOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const filtered = useMemo(() => {
    const q = fold(value.trim())
    if (!q) return options.slice(0, 120)
    return options.filter((x) => fold(x).includes(q)).slice(0, 120)
  }, [options, value])

  useEffect(() => {
    if (!suggestOpen) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setSuggestOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [suggestOpen])

  return (
    <div className="ra-fld ra-owner-listing__combo" ref={wrapRef}>
      <span>{label}</span>
      <input
        id={inputId}
        type="search"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setSuggestOpen(true)
        }}
        onFocus={() => setSuggestOpen(true)}
        required={required}
        aria-controls={filtered.length ? listId : undefined}
      />
      {!disabled && suggestOpen && filtered.length > 0 && (
        <ul id={listId} className="ra-search__suggest" role="listbox">
          {filtered.map((c) => (
            <li key={`${c}-${fold(c)}`} role="option">
              <button
                type="button"
                className="ra-search__suggest-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(c)
                  setSuggestOpen(false)
                }}
              >
                {c}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type TabId = 'basic' | 'owners' | 'images' | 'export' | 'map'

export function AccommodationListingModal({
  open,
  onClose,
  profile,
  formCategory,
  onSaved,
  editingOwnerRowId = null,
}: Props) {
  const { t } = useTranslation()
  const listId = useId()
  const [tab, setTab] = useState<TabId>('basic')
  const [helpOpen, setHelpOpen] = useState(false)

  const [receivedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const subscriptionEndYmd = useMemo(
    () => subscriptionValidUntilYmd(profile.validUntil),
    [profile.validUntil],
  )

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

  const [carMake, setCarMake] = useState('')
  const [carModel, setCarModel] = useState('')
  const [carYear, setCarYear] = useState('')
  const [carFuel, setCarFuel] = useState('')
  const [carEngineCc, setCarEngineCc] = useState('')
  const [carMaxPassengers, setCarMaxPassengers] = useState('')
  const [carDoors, setCarDoors] = useState('')
  const [carTransmission, setCarTransmission] = useState('')
  const [carLuggageLarge, setCarLuggageLarge] = useState('')
  const [carLuggageSmall, setCarLuggageSmall] = useState('')
  const [carColor, setCarColor] = useState('')
  const [carSeatsNote, setCarSeatsNote] = useState('')
  const [carExtras, setCarExtras] = useState<CarListingExtras>(() => defaultCarListingExtras())
  const [motorcycleExtras, setMotorcycleExtras] = useState<MotorcycleListingExtras>(() =>
    defaultMotorcycleListingExtras(),
  )

  const vehicleModelOptions = useMemo(() => {
    if (formCategory === 'motorcycle') return motorcycleModelsForMake(carMake)
    return vehicleModelsForMake(carMake)
  }, [formCategory, carMake])

  const vehicleMakes = formCategory === 'motorcycle' ? MOTORCYCLE_MAKES : VEHICLE_MAKES

  const setMoneyExtra = useCallback((key: CarMoneyKey, patch: Partial<CarExtraMoney>) => {
    setCarExtras((p) => ({ ...p, [key]: { ...p[key], ...patch } }))
  }, [])

  const setMotoMoneyExtra = useCallback((key: MotoMoneyKey, patch: Partial<MotoExtraMoney>) => {
    setMotorcycleExtras((p) => ({ ...p, [key]: { ...p[key], ...patch } }))
  }, [])

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
  const availableFromRef = useRef<HTMLInputElement>(null)

  const openAvailableFromPicker = () => {
    const el = availableFromRef.current
    if (!el) return
    try {
      el.showPicker()
    } catch {
      el.focus()
    }
  }

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
      phoneScope: 'this_listing',
      showAvatarOnAllListings: false,
    },
  ])
  const [socialExportConsent, setSocialExportConsent] = useState(false)
  const [contactVis, setContactVis] = useState<'both' | 'email' | 'phone'>('both')
  const [contactModalOpen, setContactModalOpen] = useState(false)
  const [contactEdit, setContactEdit] = useState<ContactDraft | null>(null)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [contactPhotoContactId, setContactPhotoContactId] = useState<string | null>(null)
  const [contactPhotoBusy, setContactPhotoBusy] = useState(false)
  const contactPhotoFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!contactPhotoContactId) setContactPhotoBusy(false)
  }, [contactPhotoContactId])
  const flushDraftRef = useRef<(contactsOverride?: ContactRow[]) => void>(() => {})
  const savedDashboardRowIdRef = useRef<string | null>(null)
  const editingOwnerRowIdRef = useRef<string | null>(editingOwnerRowId)
  editingOwnerRowIdRef.current = editingOwnerRowId

  const [imageUrlsText, setImageUrlsText] = useState('')
  const [images, setImages] = useState<{ id: string; label: string }[]>([])
  const [thumbReorderFrom, setThumbReorderFrom] = useState<number | null>(null)
  const [thumbReorderHover, setThumbReorderHover] = useState<number | null>(null)
  const thumbReorderFromRef = useRef<number | null>(null)
  const thumbReorderHoverRef = useRef<number | null>(null)
  const thumbTouchReorderRef = useRef<{
    timer: ReturnType<typeof setTimeout> | null
    mode: 'idle' | 'pending' | 'drag'
    startX: number
    startY: number
    pendingIdx: number | null
  }>({ timer: null, mode: 'idle', startX: 0, startY: 0, pendingIdx: null })

  const thumbDragDocListenersRef = useRef<{
    move: (e: TouchEvent) => void
    end: (e: TouchEvent) => void
  } | null>(null)

  const detachThumbDragDocumentListeners = () => {
    const L = thumbDragDocListenersRef.current
    if (!L) return
    document.removeEventListener('touchmove', L.move, { capture: true })
    document.removeEventListener('touchend', L.end, { capture: true })
    document.removeEventListener('touchcancel', L.end, { capture: true })
    thumbDragDocListenersRef.current = null
  }

  const clearThumbReorderTimer = () => {
    const st = thumbTouchReorderRef.current
    if (st.timer) {
      clearTimeout(st.timer)
      st.timer = null
    }
  }

  const finishThumbTouchReorder = () => {
    detachThumbDragDocumentListeners()
    clearThumbReorderTimer()
    const st = thumbTouchReorderRef.current
    if (st.mode === 'drag') {
      const from = thumbReorderFromRef.current
      const to = thumbReorderHoverRef.current
      if (from != null && to != null && from !== to) {
        setImages((prev) => {
          const n = [...prev]
          const [item] = n.splice(from, 1)
          n.splice(to, 0, item)
          return n
        })
      }
    }
    st.mode = 'idle'
    st.pendingIdx = null
    thumbReorderFromRef.current = null
    thumbReorderHoverRef.current = null
    setThumbReorderFrom(null)
    setThumbReorderHover(null)
  }

  /** Dugi pritisak → nativni document touchmove (passive: false) da skrol ne „pokrade“ gest. */
  const onThumbTouchStart = (i: number, e: React.TouchEvent<HTMLLIElement>) => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    clearThumbReorderTimer()
    detachThumbDragDocumentListeners()
    const st = thumbTouchReorderRef.current
    st.mode = 'pending'
    st.pendingIdx = i
    st.startX = t.clientX
    st.startY = t.clientY
    st.timer = window.setTimeout(() => {
      st.timer = null
      const idx = st.pendingIdx
      if (idx == null || st.mode !== 'pending') return
      st.mode = 'drag'
      thumbReorderFromRef.current = idx
      thumbReorderHoverRef.current = idx
      setThumbReorderFrom(idx)
      setThumbReorderHover(idx)
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(25)

      detachThumbDragDocumentListeners()
      const onMove = (ev: TouchEvent) => {
        if (thumbTouchReorderRef.current.mode !== 'drag') return
        if (ev.touches.length === 0) return
        const p = ev.touches[0]
        ev.preventDefault()
        const el = document.elementFromPoint(p.clientX, p.clientY)
        const li = el?.closest('[data-thumb-i]') as HTMLElement | null
        if (!li) return
        const j = Number(li.dataset.thumbI)
        if (Number.isNaN(j)) return
        thumbReorderHoverRef.current = j
        setThumbReorderHover(j)
      }
      const onEnd = (ev: TouchEvent) => {
        if (thumbTouchReorderRef.current.mode !== 'drag') {
          detachThumbDragDocumentListeners()
          return
        }
        const ch = ev.changedTouches[0]
        if (ch) {
          const el = document.elementFromPoint(ch.clientX, ch.clientY)
          const li = el?.closest('[data-thumb-i]') as HTMLElement | null
          if (li) {
            const j = Number(li.dataset.thumbI)
            if (!Number.isNaN(j)) {
              thumbReorderHoverRef.current = j
              setThumbReorderHover(j)
            }
          }
        }
        detachThumbDragDocumentListeners()
        finishThumbTouchReorder()
      }
      document.addEventListener('touchmove', onMove, { passive: false, capture: true })
      document.addEventListener('touchend', onEnd, { capture: true })
      document.addEventListener('touchcancel', onEnd, { capture: true })
      thumbDragDocListenersRef.current = { move: onMove, end: onEnd }
    }, 420)
  }

  const onThumbTouchMove = (e: React.TouchEvent<HTMLLIElement>) => {
    const st = thumbTouchReorderRef.current
    const t = e.touches[0]
    if (!t) return
    if (st.mode !== 'pending' || !st.timer) return
    const dx = t.clientX - st.startX
    const dy = t.clientY - st.startY
    if (Math.hypot(dx, dy) > 48) {
      clearThumbReorderTimer()
      st.mode = 'idle'
      st.pendingIdx = null
    }
  }

  const onThumbLiTouchEndOrCancel = () => {
    const st = thumbTouchReorderRef.current
    if (st.mode !== 'pending') return
    clearThumbReorderTimer()
    st.mode = 'idle'
    st.pendingIdx = null
  }

  const [exportSocial, setExportSocial] = useState(false)
  const [linkedContactIds, setLinkedContactIds] = useState<string[]>(() => ['owner-1'])

  const [mapLat, setMapLat] = useState<number | null>(42.4247)
  const [mapLng, setMapLng] = useState<number | null>(18.7712)
  const [mapPrecise, setMapPrecise] = useState(true)
  const [mapZoom] = useState(14)

  const maxContacts = maxContactsForPlan(profile.plan ?? 'basic')
  const showContactCats = profile.plan === 'pro' || profile.plan === 'agency'

  /**
   * HTML5 drag na <li> remeti touch na pravim telefonima. `(pointer: coarse)` u Chrome
   * DevTools-u često ostane false (miš), pa je ranije ostajalo draggable=true.
   * `maxTouchPoints === 0` ≈ desktop bez touch ekrana.
   */
  const allowHtml5ThumbDrag = typeof navigator !== 'undefined' && navigator.maxTouchPoints === 0

  useEffect(() => {
    if (!open) {
      detachThumbDragDocumentListeners()
      clearThumbReorderTimer()
      thumbTouchReorderRef.current.mode = 'idle'
      thumbTouchReorderRef.current.pendingIdx = null
      setThumbReorderFrom(null)
      setThumbReorderHover(null)
    }
  }, [open])

  useEffect(() => {
    return () => detachThumbDragDocumentListeners()
  }, [])

  useEffect(() => {
    if (!open) return
    setTab('basic')
  }, [open, formCategory])

  useEffect(() => {
    if (!open) setHelpOpen(false)
  }, [open])

  /** Jedan scroll na panelu + bez skrola stranice — Chrome Android ispod modala. */
  useEffect(() => {
    if (!open) return
    const html = document.documentElement
    const body = document.body
    const prev = {
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
    }
    html.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prev.htmlOverflow
      html.style.overscrollBehavior = prev.htmlOverscroll
      body.style.overflow = prev.bodyOverflow
    }
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

  const pickSourceLang = useCallback((): ListingLangId | null => {
    const acT = titlesRef.current[activeLang]?.trim() ?? ''
    const acD = descriptionsRef.current[activeLang]?.trim() ?? ''
    if (acT || acD) return activeLang
    for (const l of LISTING_LANG_IDS) {
      const ti = titlesRef.current[l]?.trim() ?? ''
      const de = descriptionsRef.current[l]?.trim() ?? ''
      if (ti || de) return l
    }
    return null
  }, [activeLang])

  const runTranslate = useCallback(async () => {
    const src = pickSourceLang()
    if (!src) return
    const ti = titlesRef.current[src]?.trim() ?? ''
    const de = descriptionsRef.current[src]?.trim() ?? ''
    if (!ti && !de) return
    setTranslating(true)
    try {
      const targets = LISTING_LANG_IDS.filter((l) => l !== src)
      const { titles: tts, descriptions: dds } = await translateListingFields(src, ti, de, targets)
      const nextTitles = { ...titlesRef.current, ...tts }
      const nextDesc = { ...descriptionsRef.current, ...dds }
      setTitles(nextTitles)
      setDescriptions(nextDesc)
    } finally {
      setTranslating(false)
    }
  }, [pickSourceLang])

  const translateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushTranslate = useCallback(() => {
    if (translateDebounceRef.current) {
      clearTimeout(translateDebounceRef.current)
      translateDebounceRef.current = null
    }
    void runTranslate()
  }, [runTranslate])
  const scheduleTranslate = useCallback(() => {
    if (translateDebounceRef.current) clearTimeout(translateDebounceRef.current)
    translateDebounceRef.current = setTimeout(() => {
      translateDebounceRef.current = null
      void runTranslate()
    }, 720)
  }, [runTranslate])

  const flushTranslateRef = useRef(flushTranslate)
  flushTranslateRef.current = flushTranslate

  const prevActiveLangRef = useRef<ListingLangId | null>(null)
  useEffect(() => {
    if (!open) {
      prevActiveLangRef.current = null
      return
    }
    const prev = prevActiveLangRef.current
    prevActiveLangRef.current = activeLang
    if (prev === null || prev === activeLang) return
    scheduleTranslate()
  }, [activeLang, open, scheduleTranslate])

  useEffect(
    () => () => {
      if (translateDebounceRef.current) clearTimeout(translateDebounceRef.current)
    },
    [],
  )

  useEffect(() => {
    if (!open) return
    savedDashboardRowIdRef.current = editingOwnerRowId ?? null
    const empty = Object.fromEntries(LISTING_LANG_IDS.map((l) => [l, ''])) as Record<string, string>

    // Server-backed draft: editing works across devices.
    if (editingOwnerRowId) {
      void (async () => {
        const remote = await fetchDraft({
          asAdmin: isAdminSession(),
          ownerUserId: profile.userId,
          rowId: editingOwnerRowId,
          category: formCategory,
        })
        if (!remote) return
        // Re-run this init logic with the remote draft.
        const dd = remote
        setTitles({ ...empty, ...dd.titles })
        setDescriptions({ ...empty, ...dd.descriptions })
        setPropertyType(dd.propertyType)
        setStructure(dd.structure === 'layout_studio' ? 'layoutStudio' : dd.structure)
        setAreaM2(dd.areaM2)
        setFloor(dd.floor)
        setPriceEur(dd.priceEur)
        setPricePre(dd.pricePre)
        setPriceSeason(dd.priceSeason)
        setPricePost(dd.pricePost)
        setPriceOff(dd.priceOff)
        setFurnished(dd.furnished)
        setBathrooms(dd.bathrooms)
        setPayCashCard(dd.payCashCard)
        setPayCash(dd.payCash)
        setPayCard(dd.payCard)
        setPayBank(dd.payBank)
        setAvailableFrom(dd.availableFrom)
        setCountryId(dd.countryId ?? 'me')
        setCity(dd.city)
        setMunicipality(dd.municipality)
        setDistrict(dd.district)
        setStreet(dd.street)
        setStreetNo(dd.streetNo)
        setApt(dd.apt)
        setFeatHeating(new Set(dd.featHeating))
        setFeatFurniture(new Set(dd.featFurniture))
        setFeatEquipment(new Set(dd.featEquipment))
        setFeatRules(new Set(dd.featRules))
        setImages(dd.images.map((label, i) => ({ id: `draft-img-${i}`, label })))
        setExportSocial(dd.exportSocial)
        setSocialExportConsent(dd.socialExportConsent)
        setContacts(
          (dd.contacts ?? []).map((c) => ({
            ...c,
            categories: asListingCategoryArray((c as { categories?: unknown }).categories),
          })),
        )
        setLinkedContactIds(dd.linkedContactIds ?? ['owner-1'])
        setContactVis(dd.contactVis ?? 'both')
        setMapLat(dd.lat ?? 42.4247)
        setMapLng(dd.lng ?? 18.7712)
        setCarMake(dd.carMake ?? '')
        setCarModel(dd.carModel ?? '')
        setCarYear(dd.carYear ?? '')
        setCarFuel(dd.carFuel ?? '')
        setCarEngineCc(dd.carEngineCc ?? '')
        setCarMaxPassengers(dd.carMaxPassengers ?? '')
        setCarDoors(dd.carDoors ?? '')
        setCarTransmission(dd.carTransmission ?? '')
        setCarLuggageLarge(dd.carLuggageLarge ?? '')
        setCarLuggageSmall(dd.carLuggageSmall ?? '')
        setCarColor(dd.carColor ?? '')
        setCarSeatsNote(dd.carSeatsNote ?? '')
        setCarExtras(normalizeCarListingExtras(dd.carExtras))
        setMotorcycleExtras(normalizeMotorcycleListingExtras(dd.motorcycleExtras))
      })()
      const tmr = window.setTimeout(() => flushTranslateRef.current(), 850)
      return () => window.clearTimeout(tmr)
    }

    // New listing draft: keep only in memory until first Save (rowId exists).
    if (formCategory === 'car' || formCategory === 'motorcycle') {
      setTitles(empty)
      setDescriptions(empty)
      setCarMake('')
      setCarModel('')
      setCarYear('')
      setCarFuel('')
      setCarEngineCc('')
      setCarMaxPassengers('')
      setCarDoors('')
      setCarTransmission('')
      setCarLuggageLarge('')
      setCarLuggageSmall('')
      setCarColor('')
      setCarSeatsNote('')
      setCarExtras(defaultCarListingExtras())
      setMotorcycleExtras(defaultMotorcycleListingExtras())
      setPropertyType('')
      setStructure('')
      setAreaM2('')
      setFloor('')
      setPriceEur('')
      setPricePre('')
      setPriceSeason('')
      setPricePost('')
      setPriceOff('')
      setFurnished('')
      setBathrooms('')
      setPayCashCard(false)
      setPayCash(false)
      setPayCard(false)
      setPayBank(false)
      setAvailableFrom('')
      setCountryId('me')
      setCity('')
      setMunicipality('')
      setDistrict('')
      setStreet('')
      setStreetNo('')
      setApt('')
      setFeatHeating(new Set())
      setFeatFurniture(new Set())
      setFeatEquipment(new Set())
      setFeatRules(new Set())
      setImages([])
      setExportSocial(false)
      setSocialExportConsent(false)
      setContacts([
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
          phoneScope: 'this_listing',
          showAvatarOnAllListings: false,
        },
      ])
      setLinkedContactIds(['owner-1'])
      setContactVis('both')
      setMapLat(42.4247)
      setMapLng(18.7712)
    }
    return
  }, [open, editingOwnerRowId, formCategory, profile.userId, profile.displayName, profile.email])

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => {
      const rowId = savedDashboardRowIdRef.current ?? editingOwnerRowIdRef.current
      if (!rowId) return
      const draft = {
        formCategory,
        titles,
        descriptions,
        countryId,
        city,
        municipality,
        district,
        street,
        streetNo,
        apt,
        propertyType,
        structure,
        areaM2,
        floor,
        bathrooms,
        furnished,
        priceEur,
        pricePre,
        priceSeason,
        pricePost,
        priceOff,
        availableFrom,
        payCashCard,
        payCash,
        payCard,
        payBank,
        featHeating: [...featHeating],
        featFurniture: [...featFurniture],
        featEquipment: [...featEquipment],
        featRules: [...featRules],
        images: images.map((x) => x.label),
        exportSocial,
        socialExportConsent,
        contacts,
        linkedContactIds,
        contactVis,
        lat: mapLat,
        lng: mapLng,
        carMake,
        carModel,
        carYear,
        carFuel,
        carEngineCc,
        carMaxPassengers,
        carDoors,
        carTransmission,
        carLuggageLarge,
        carLuggageSmall,
        carColor,
        carSeatsNote,
        carExtras: formCategory === 'car' ? carExtras : undefined,
        motorcycleExtras: formCategory === 'motorcycle' ? motorcycleExtras : undefined,
      }
      void saveDraft({
        asAdmin: isAdminSession(),
        ownerUserId: profile.userId,
        rowId,
        category: formCategory,
        draft,
      })
    }, 1300)
    return () => window.clearTimeout(id)
  }, [open, titles, descriptions, editingOwnerRowId, formCategory, profile.userId, countryId, city, municipality, district, street, streetNo, apt, propertyType, structure, areaM2, floor, bathrooms, furnished, priceEur, pricePre, priceSeason, pricePost, priceOff, availableFrom, payCashCard, payCash, payCard, payBank, featHeating, featFurniture, featEquipment, featRules, images, exportSocial, socialExportConsent, contacts, linkedContactIds, contactVis, mapLat, mapLng, carMake, carModel, carYear, carFuel, carEngineCc, carMaxPassengers, carDoors, carTransmission, carLuggageLarge, carLuggageSmall, carColor, carSeatsNote, carExtras, motorcycleExtras])

  const onTitleBlur = () => flushTranslate()
  const onDescBlur = () => flushTranslate()

  const toggleContactLinked = useCallback((contactId: string) => {
    setLinkedContactIds((prev) => {
      if (prev.includes(contactId)) {
        if (prev.length <= 1) return prev
        return prev.filter((x) => x !== contactId)
      }
      return [...prev, contactId]
    })
  }, [])

  const onContactPhotoFile = useCallback(
    async (files: FileList | null) => {
      const f = files?.[0]
      if (!f || !contactPhotoContactId) return
      if (!f.type.startsWith('image/')) return
      setContactPhotoBusy(true)
      try {
        const dataUrl = await fileToResizedJpegDataUrl(f, 400)
        if (dataUrl.length > 1_200_000) {
          window.alert(t('owner.profilePage.errAvatarTooLarge'))
          return
        }
        let publicUrl: string | null = null
        try {
          const res = await fetch('/api/owner-contact-avatar-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ contactId: contactPhotoContactId, dataUrl }),
          })
          const j = (await res.json().catch(() => ({}))) as { ok?: boolean; publicUrl?: string }
          if (res.ok && j?.ok === true && typeof j.publicUrl === 'string' && j.publicUrl.trim()) {
            publicUrl = j.publicUrl.trim()
          }
        } catch {
          /* offline / no API — ostaje data URL */
        }
        setContacts((prev) => {
          const next = prev.map((row) =>
            row.id === contactPhotoContactId
              ? publicUrl
                ? { ...row, avatarUrl: publicUrl, avatarDataUrl: null }
                : { ...row, avatarUrl: null, avatarDataUrl: dataUrl }
              : row,
          )
          queueMicrotask(() => flushDraftRef.current(next))
          return next
        })
      } catch {
        window.alert(t('owner.profilePage.errAvatarRead'))
      } finally {
        setContactPhotoBusy(false)
        if (contactPhotoFileRef.current) contactPhotoFileRef.current.value = ''
      }
    },
    [contactPhotoContactId, t],
  )

  const clearContactPhoto = useCallback(() => {
    if (!contactPhotoContactId) return
    setContacts((prev) => {
      const next = prev.map((row) =>
        row.id === contactPhotoContactId ? { ...row, avatarDataUrl: null, avatarUrl: null } : row,
      )
      queueMicrotask(() => flushDraftRef.current(next))
      return next
    })
  }, [contactPhotoContactId])

  const contactPhotoRow = useMemo(
    () => (contactPhotoContactId ? contacts.find((c) => c.id === contactPhotoContactId) : null),
    [contacts, contactPhotoContactId],
  )

  const geocodeAndPin = useCallback(
    async (cityOverride?: string) => {
      const c = (cityOverride ?? city).trim()
      if (!countryId || !c) return
      const countryName = t(`search.country_${countryId}`)
      const q = `${c}, ${countryName}`
      const pos = await geocodeCityLabel(q)
      if (pos) {
        setMapLat(pos.lat)
        setMapLng(pos.lng)
      }
    },
    [countryId, city, t],
  )

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

  flushDraftRef.current = (contactsOverride?: ContactRow[]) => {
    const contactsPayload = contactsOverride ?? contacts
    const payload: AccommodationListingDraft = {
      formCategory,
      titles,
      descriptions,
      countryId,
      city,
      municipality,
      district,
      street,
      streetNo,
      apt,
      propertyType,
      structure,
      areaM2,
      floor,
      bathrooms,
      furnished,
      priceEur,
      pricePre,
      priceSeason,
      pricePost,
      priceOff,
      availableFrom,
      payCashCard,
      payCash,
      payCard,
      payBank,
      featHeating: [...featHeating],
      featFurniture: [...featFurniture],
      featEquipment: [...featEquipment],
      featRules: [...featRules],
      images: images.map((x) => x.label),
      exportSocial,
      socialExportConsent,
      contacts: contactsPayload,
      linkedContactIds,
      contactVis,
      lat: mapLat,
      lng: mapLng,
      carMake,
      carModel,
      carYear,
      carFuel,
      carEngineCc,
      carMaxPassengers,
      carDoors,
      carTransmission,
      carLuggageLarge,
      carLuggageSmall,
      carColor,
      carSeatsNote,
      carExtras: formCategory === 'car' ? carExtras : undefined,
      motorcycleExtras: formCategory === 'motorcycle' ? motorcycleExtras : undefined,
    }
    if (profile.userId) {
      syncContactAvatarGlobals(profile.userId, contactsPayload)
    }

    const rowId = savedDashboardRowIdRef.current ?? editingOwnerRowIdRef.current
    if (rowId && profile.userId) {
      saveDraftLocally(formCategory, rowId, payload)
      void saveDraft({
        asAdmin: isAdminSession(),
        ownerUserId: profile.userId,
        rowId,
        category: formCategory,
        draft: payload,
      })
    }
  }

  const handleSave = () => {
    if (!validate()) return

    let titleForRow = titles[activeLang]?.trim() ?? ''
    if (!titleForRow) {
      for (const l of LISTING_LANG_IDS) {
        const x = titles[l]?.trim() ?? ''
        if (x) {
          titleForRow = x
          break
        }
      }
    }
    if (!titleForRow) titleForRow = '—'

    const result =
      formCategory === 'car'
        ? upsertOwnerCarListingRow({
            userId: profile.userId,
            plan: profile.plan,
            existingRowId: savedDashboardRowIdRef.current,
            title: titleForRow,
            receivedAtYmd: receivedAt,
            expiresAtYmd: subscriptionEndYmd,
          })
        : formCategory === 'motorcycle'
          ? upsertOwnerMotorcycleListingRow({
              userId: profile.userId,
              plan: profile.plan,
              existingRowId: savedDashboardRowIdRef.current,
              title: titleForRow,
              receivedAtYmd: receivedAt,
              expiresAtYmd: subscriptionEndYmd,
            })
          : upsertOwnerAccommodationListingRow({
              userId: profile.userId,
              plan: profile.plan,
              existingRowId: savedDashboardRowIdRef.current,
              title: titleForRow,
              receivedAtYmd: receivedAt,
              expiresAtYmd: subscriptionEndYmd,
            })

    if (!result.ok) {
      if (result.reason === 'blocked') {
        window.alert(t('owner.listing.errBlocked'))
        return
      }
      const max =
        profile.plan != null
          ? maxListingsForOwnerCategory(profile.userId, profile.plan, formCategory)
          : 0
      window.alert(t('owner.listing.errListingLimit', { max }))
      return
    }
    savedDashboardRowIdRef.current = result.rowId
    const pid = publicListingIdForSavedRow(formCategory, result.rowId)
    setListingInquiryNotifyEmail(pid, deriveNotifyEmail(contacts, profile.email))

    const countryPart = countryId ? t(`search.country_${countryId}`) : ''
    const locationStr =
      city.trim() && countryPart
        ? `${city.trim()}, ${countryPart}`
        : city.trim() || countryPart || '—'
    const priceStr = priceEur.trim() ? `€${priceEur.trim()}` : '—'
    let phoneStr = ''
    for (const c of contacts) {
      const p = c.phone?.trim()
      if (p) {
        phoneStr = p
        break
      }
    }
    if (exportSocial && socialExportConsent) {
      const img0 = images[0]?.label
      const imageDataUrl =
        img0 && (img0.startsWith('data:') || img0.startsWith('http')) ? img0 : null
      void enqueueListingSocial({
        listingPublicId: pid,
        category: formCategory,
        title: titleForRow,
        location: locationStr,
        priceLabel: priceStr,
        phone: phoneStr,
        imageDataUrl,
      })
    }

    flushDraftRef.current()
    onClose()
    onSaved?.()
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
    if (formCategory === 'car' || formCategory === 'motorcycle') {
      if (
        !carMake.trim() ||
        !carModel.trim() ||
        !carYear.trim() ||
        !carTransmission ||
        !priceEur.trim()
      ) {
        window.alert(
          formCategory === 'motorcycle' ? t('owner.listing.errFieldsMoto') : t('owner.listing.errFieldsCar'),
        )
        return false
      }
    } else if (!propertyType || !structure || !areaM2.trim() || !priceEur.trim()) {
      window.alert(t('owner.listing.errFields'))
      return false
    }
    if (images.length === 0) {
      window.alert(t('owner.listing.errImages'))
      return false
    }
    if (exportSocial && !socialExportConsent) {
      window.alert(t('owner.listing.errSocialConsent'))
      return false
    }
    if (!linkedContactIds.some((lid) => contacts.some((c) => c.id === lid))) {
      window.alert(t('owner.listing.errNoLinkedContact'))
      return false
    }
    return true
  }

  if (!open || !profile.plan) return null

  const tabOrder: TabId[] = ['basic', 'owners', 'images', 'export', 'map']
  const goNextTab = () => {
    const i = tabOrder.indexOf(tab)
    if (i < tabOrder.length - 1) setTab(tabOrder[i + 1]!)
  }
  const goPrevTab = () => {
    const i = tabOrder.indexOf(tab)
    if (i > 0) setTab(tabOrder[i - 1]!)
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
          <div className="ra-owner-listing__head-top">
            <div className="ra-owner-listing__brand">
              <img
                src={`${import.meta.env.BASE_URL}rentadria-logo.png`}
                alt=""
                className="ra-owner-listing__logo-img"
                width={36}
                height={36}
                decoding="async"
              />
              <h2 id="owner-listing-title" className="ra-owner-listing__title">
                {formCategory === 'car'
                  ? t('owner.listing.modalTitleCar')
                  : formCategory === 'motorcycle'
                    ? t('owner.listing.modalTitleMoto')
                    : t('owner.listing.modalTitle')}
              </h2>
            </div>
            <button type="button" className="ra-modal__close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
          <nav
            role="tablist"
            aria-label={t('owner.listing.tabMenuAria')}
            className="ra-owner-listing__tab-strip"
          >
            {tabs.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                id={`owner-listing-tab-${x.id}`}
                aria-selected={tab === x.id}
                aria-controls="owner-listing-panel"
                className={`ra-owner-listing__tab-chip ${tab === x.id ? 'is-active' : ''}`}
                onClick={() => setTab(x.id)}
              >
                {x.label}
              </button>
            ))}
          </nav>
        </header>

        <div className="ra-owner-listing__main-wrap">
          <div
            id="owner-listing-panel"
            className="ra-owner-listing__body"
            role="tabpanel"
            aria-labelledby={`owner-listing-tab-${tab}`}
          >
          {tab === 'basic' && (
            <div className="ra-owner-listing__basic ra-owner-listing__basic--split-scroll">
              <p className="ra-owner-listing__note">{t('owner.listing.emailNotice')}</p>
              <div className="ra-owner-listing__main-split">
                <div className="ra-owner-listing__main-split-left">
                  <div className="ra-owner-listing__dates-row">
                    <label className="ra-fld">
                      <span>{t('owner.listing.receivedAt')}</span>
                      <input readOnly value={formatDateDayMonthYear(receivedAt)} />
                    </label>
                    <label className="ra-fld">
                      <span>{t('owner.listing.subExpires')}</span>
                      <input readOnly value={formatDateDayMonthYear(subscriptionEndYmd)} />
                    </label>
                  </div>

              {formCategory === 'car' || formCategory === 'motorcycle' ? (
                <>
                  <div className="ra-owner-listing__row-3 ra-owner-listing__compact-fld">
                    <SearchableCombo
                      label={
                        <>
                          {t('owner.listing.carMake')} <span className="ra-req">*</span>
                        </>
                      }
                      value={carMake}
                      onChange={(v) => {
                        setCarMake(v)
                        setCarModel('')
                      }}
                      options={vehicleMakes}
                      placeholder={t('owner.listing.carMakePh')}
                      required
                      inputId={`${listId}-car-make`}
                      listId={`${listId}-car-make-sug`}
                    />
                    <SearchableCombo
                      label={
                        <>
                          {t('owner.listing.carModel')} <span className="ra-req">*</span>
                        </>
                      }
                      value={carModel}
                      onChange={setCarModel}
                      options={vehicleModelOptions}
                      placeholder={t('owner.listing.carModelPh')}
                      required
                      disabled={!carMake.trim()}
                      inputId={`${listId}-car-model`}
                      listId={`${listId}-car-model-sug`}
                    />
                    <div />
                  </div>

                  <div className="ra-owner-listing__row-3 ra-owner-listing__compact-fld">
                    <label className="ra-fld">
                      <span>
                        {t('owner.listing.carYear')} <span className="ra-req">*</span>
                      </span>
                      <input
                        value={carYear}
                        onChange={(e) => setCarYear(e.target.value)}
                        placeholder={t('owner.listing.carYearPh')}
                        inputMode="numeric"
                      />
                    </label>
                    <label className="ra-fld">
                      <span>{t('owner.listing.carFuel')}</span>
                      <select value={carFuel} onChange={(e) => setCarFuel(e.target.value)}>
                        <option value="">—</option>
                        <option value="petrol">{t('owner.listing.carFuelOpt.petrol')}</option>
                        <option value="diesel">{t('owner.listing.carFuelOpt.diesel')}</option>
                        <option value="electric">{t('owner.listing.carFuelOpt.electric')}</option>
                        <option value="hybrid">{t('owner.listing.carFuelOpt.hybrid')}</option>
                        <option value="lpg">{t('owner.listing.carFuelOpt.lpg')}</option>
                        <option value="other">{t('owner.listing.carFuelOpt.other')}</option>
                      </select>
                    </label>
                    <label className="ra-fld">
                      <span>{t('owner.listing.carEngineCc')}</span>
                      <input
                        value={carEngineCc}
                        onChange={(e) => setCarEngineCc(e.target.value)}
                        placeholder={t('owner.listing.carEnginePh')}
                        inputMode="numeric"
                      />
                    </label>
                  </div>

                  {formCategory === 'car' ? (
                    <div className="ra-owner-listing__row-3 ra-owner-listing__compact-fld">
                      <label className="ra-fld">
                        <span>{t('owner.listing.carMaxPassengers')}</span>
                        <select value={carMaxPassengers} onChange={(e) => setCarMaxPassengers(e.target.value)}>
                          <option value="">—</option>
                          {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                            <option key={n} value={String(n)}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="ra-fld">
                        <span>{t('owner.listing.carDoors')}</span>
                        <select value={carDoors} onChange={(e) => setCarDoors(e.target.value)}>
                          <option value="">—</option>
                          {['2', '3', '4', '5'].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="ra-fld">
                        <span>
                          {t('owner.listing.carTransmission')} <span className="ra-req">*</span>
                        </span>
                        <select
                          value={carTransmission}
                          onChange={(e) => setCarTransmission(e.target.value)}
                          required
                        >
                          <option value="">—</option>
                          <option value="manual">{t('owner.listing.carGear.manual')}</option>
                          <option value="automatic">{t('owner.listing.carGear.automatic')}</option>
                          <option value="semi_automatic">{t('owner.listing.carGear.semiAutomatic')}</option>
                          <option value="cvt">{t('owner.listing.carGear.cvt')}</option>
                          <option value="dual_clutch">{t('owner.listing.carGear.dualClutch')}</option>
                        </select>
                      </label>
                    </div>
                  ) : (
                    <div className="ra-owner-listing__row-3 ra-owner-listing__compact-fld">
                      <div />
                      <div />
                      <label className="ra-fld">
                        <span>
                          {t('owner.listing.carTransmission')} <span className="ra-req">*</span>
                        </span>
                        <select
                          value={carTransmission}
                          onChange={(e) => setCarTransmission(e.target.value)}
                          required
                        >
                          <option value="">—</option>
                          <option value="manual">{t('owner.listing.carGear.manual')}</option>
                          <option value="automatic">{t('owner.listing.carGear.automatic')}</option>
                          <option value="semi_automatic">{t('owner.listing.carGear.semiAutomatic')}</option>
                          <option value="cvt">{t('owner.listing.carGear.cvt')}</option>
                          <option value="dual_clutch">{t('owner.listing.carGear.dualClutch')}</option>
                        </select>
                      </label>
                    </div>
                  )}

                  {formCategory === 'car' && (
                    <div className="ra-owner-listing__row-3 ra-owner-listing__compact-fld">
                      <label className="ra-fld">
                        <span>{t('owner.listing.carLuggageLarge')}</span>
                        <input
                          value={carLuggageLarge}
                          onChange={(e) => setCarLuggageLarge(e.target.value)}
                          placeholder={t('owner.listing.phLuggage')}
                          inputMode="numeric"
                        />
                      </label>
                      <label className="ra-fld">
                        <span>{t('owner.listing.carLuggageSmall')}</span>
                        <input
                          value={carLuggageSmall}
                          onChange={(e) => setCarLuggageSmall(e.target.value)}
                          placeholder={t('owner.listing.phLuggage')}
                          inputMode="numeric"
                        />
                      </label>
                      <label className="ra-fld">
                        <span>{t('owner.listing.carSeatsNote')}</span>
                        <input
                          value={carSeatsNote}
                          onChange={(e) => setCarSeatsNote(e.target.value)}
                          placeholder={t('owner.listing.carSeatsPh')}
                        />
                      </label>
                    </div>
                  )}

                  <div className="ra-owner-listing__row-3 ra-owner-listing__compact-fld">
                    <label className="ra-fld ra-owner-listing__floor-grow">
                      <span>{t('owner.listing.carColor')}</span>
                      <input
                        value={carColor}
                        onChange={(e) => setCarColor(e.target.value)}
                        placeholder={t('owner.listing.carColorPh')}
                      />
                    </label>
                    <label className="ra-fld">
                      <span>
                        {t('owner.listing.priceDailyMain')} <span className="ra-req">*</span>
                      </span>
                      <input
                        value={priceEur}
                        onChange={(e) => setPriceEur(e.target.value)}
                        placeholder={t('owner.listing.phPriceDaily')}
                      />
                    </label>
                    <div />
                  </div>

                  <p className="ra-fld__hint">{t('owner.listing.priceDailyHint')}</p>

                  <div className="ra-owner-listing__row-floor-date">
                    <label
                      className="ra-fld ra-owner-listing__date-field"
                      onClick={(e) => {
                        if (e.target !== availableFromRef.current) openAvailableFromPicker()
                      }}
                    >
                      <span>
                        {t('owner.listing.availableFrom')}
                        {availableFrom ? ` (${formatDateDayMonthYear(availableFrom)})` : ''}
                      </span>
                      <input
                        ref={availableFromRef}
                        type="date"
                        value={availableFrom}
                        onChange={(e) => setAvailableFrom(e.target.value)}
                      />
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <div className="ra-owner-listing__row-3 ra-owner-listing__compact-fld">
                    <label className="ra-fld">
                      <span>
                        {t('owner.listing.propertyType')} <span className="ra-req">*</span>
                      </span>
                      <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} required>
                        <option value="">—</option>
                        <option value="studio">{t('owner.listing.pt.studio')}</option>
                        <option value="room">{t('owner.listing.pt.room')}</option>
                        <option value="apartment">{t('owner.listing.pt.apartment')}</option>
                        <option value="villa">{t('owner.listing.pt.villa')}</option>
                        <option value="house">{t('owner.listing.pt.house')}</option>
                        <option value="hostel">{t('owner.listing.pt.hostel')}</option>
                        <option value="hotel">{t('owner.listing.pt.hotel')}</option>
                      </select>
                    </label>
                    <label className="ra-fld">
                      <span>
                        {t('owner.listing.structure')} <span className="ra-req">*</span>
                      </span>
                      <select value={structure} onChange={(e) => setStructure(e.target.value)} required>
                        <option value="">—</option>
                        <option value="layoutStudio">{t('owner.listing.str.layoutStudio')}</option>
                        <option value="so1">{t('owner.listing.str.so1')}</option>
                        <option value="so2">{t('owner.listing.str.so2')}</option>
                        <option value="so3">{t('owner.listing.str.so3')}</option>
                        <option value="so4p">{t('owner.listing.str.so4p')}</option>
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
                        <option value="6plus">{t('owner.listing.bath6plus')}</option>
                      </select>
                    </label>
                  </div>

                  <div className="ra-owner-listing__row-3 ra-owner-listing__compact-fld">
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
                      <span>
                        {t('owner.listing.area')} <span className="ra-req">*</span>
                      </span>
                      <input value={areaM2} onChange={(e) => setAreaM2(e.target.value)} placeholder={t('owner.listing.phArea')} />
                    </label>
                    <label className="ra-fld">
                      <span>
                        {t('owner.listing.priceEur')} <span className="ra-req">*</span>
                      </span>
                      <input value={priceEur} onChange={(e) => setPriceEur(e.target.value)} placeholder={t('owner.listing.phPrice')} />
                    </label>
                  </div>

                  <div className="ra-owner-listing__row-floor-date">
                    <label className="ra-fld ra-owner-listing__floor-grow">
                      <span>{t('owner.listing.floor')}</span>
                      <input value={floor} onChange={(e) => setFloor(e.target.value)} />
                    </label>
                    <label
                      className="ra-fld ra-owner-listing__date-field ra-owner-listing__date-narrow"
                      onClick={(e) => {
                        if (e.target !== availableFromRef.current) openAvailableFromPicker()
                      }}
                    >
                      <span>
                        {t('owner.listing.availableFrom')}
                        {availableFrom ? ` (${formatDateDayMonthYear(availableFrom)})` : ''}
                      </span>
                      <input
                        ref={availableFromRef}
                        type="date"
                        value={availableFrom}
                        onChange={(e) => setAvailableFrom(e.target.value)}
                      />
                    </label>
                  </div>
                </>
              )}

              <div className="ra-owner-listing__prices-season">
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

              <h3 className="ra-owner-listing__h3">{t('owner.listing.locationTitle')}</h3>
              <div className="ra-owner-listing__loc-grid ra-owner-listing__compact-fld">
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
                    onBlur={() => {
                      setCityOpen(false)
                      void geocodeAndPin()
                    }}
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
                              void geocodeAndPin(c)
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
                <label className="ra-fld ra-owner-listing__loc-street-span">
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

              {formCategory === 'car' && (
                <div className="ra-owner-listing__car-extras">
                  <h3 className="ra-owner-listing__h3">{t('owner.listing.carExtrasTitle')}</h3>
                  <p className="ra-owner-listing__note ra-owner-listing__car-extras-intro">
                    {t('owner.listing.carExtrasIntro')}
                  </p>
                  <div className="ra-owner-listing__car-extras-cols">
                    <div className="ra-owner-listing__car-extras-col">
                      <div className="ra-owner-listing__car-extra-row">
                        <input
                          type="checkbox"
                          checked={carExtras.dailyKmLimit.on}
                          onChange={(e) =>
                            setCarExtras((p) => ({
                              ...p,
                              dailyKmLimit: { ...p.dailyKmLimit, on: e.target.checked },
                            }))
                          }
                          aria-label={t('owner.listing.carExtras.dailyKmLimit')}
                        />
                        <span className="ra-owner-listing__car-extra-label">
                          {t('owner.listing.carExtras.dailyKmLimit')}
                        </span>
                        <input
                          className="ra-owner-listing__car-extra-input"
                          type="number"
                          min="0"
                          step="1"
                          value={carExtras.dailyKmLimit.km}
                          disabled={!carExtras.dailyKmLimit.on}
                          onChange={(e) =>
                            setCarExtras((p) => ({
                              ...p,
                              dailyKmLimit: { ...p.dailyKmLimit, km: e.target.value },
                            }))
                          }
                        />
                        <span className="ra-owner-listing__car-extra-unit">
                          {t('owner.listing.carExtrasUnit.kmPerDay')}
                        </span>
                      </div>
                      {(
                        [
                          ['airportTax', 'eurPerDay'],
                          ['theftCoverage', 'eurPerDay'],
                          ['vat21', 'eurPerDay'],
                          ['babySeat', 'eurPerDay'],
                          ['boosterSeat', 'eurPerDay'],
                          ['scdw', 'eurPerDay'],
                        ] as const
                      ).map(([key, unitKey]) => (
                        <div key={key} className="ra-owner-listing__car-extra-row">
                          <input
                            type="checkbox"
                            checked={carExtras[key].on}
                            onChange={(e) => setMoneyExtra(key, { on: e.target.checked })}
                            aria-label={t(`owner.listing.carExtras.${key}`)}
                          />
                          <span className="ra-owner-listing__car-extra-label">
                            {t(`owner.listing.carExtras.${key}`)}
                          </span>
                          <input
                            className="ra-owner-listing__car-extra-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={carExtras[key].price}
                            disabled={!carExtras[key].on}
                            onChange={(e) => setMoneyExtra(key, { price: e.target.value })}
                          />
                          <span className="ra-owner-listing__car-extra-unit">
                            {t(`owner.listing.carExtrasUnit.${unitKey}`)}
                          </span>
                        </div>
                      ))}
                      <div className="ra-owner-listing__car-extra-row ra-owner-listing__car-extra-row--bool">
                        <input
                          type="checkbox"
                          checked={carExtras.airConditioning.on}
                          onChange={(e) =>
                            setCarExtras((p) => ({
                              ...p,
                              airConditioning: { on: e.target.checked },
                            }))
                          }
                          aria-label={t('owner.listing.carExtras.airConditioning')}
                        />
                        <span className="ra-owner-listing__car-extra-label">
                          {t('owner.listing.carExtras.airConditioning')}
                        </span>
                      </div>
                    </div>
                    <div className="ra-owner-listing__car-extras-col">
                      {(
                        [
                          ['extraKm', 'eurPerKm'],
                          ['damageCoverage', 'eurPerDay'],
                          ['winterTires', 'eurPerDay'],
                          ['extraDriver', 'eurPerDay'],
                          ['childSeat', 'eurPerDay'],
                          ['crossBorder', 'eurPerRental'],
                          ['gps', 'eurPerDay'],
                        ] as const
                      ).map(([key, unitKey]) => (
                        <div key={key} className="ra-owner-listing__car-extra-row">
                          <input
                            type="checkbox"
                            checked={carExtras[key].on}
                            onChange={(e) => setMoneyExtra(key, { on: e.target.checked })}
                            aria-label={t(`owner.listing.carExtras.${key}`)}
                          />
                          <span className="ra-owner-listing__car-extra-label">
                            {t(`owner.listing.carExtras.${key}`)}
                          </span>
                          <input
                            className="ra-owner-listing__car-extra-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={carExtras[key].price}
                            disabled={!carExtras[key].on}
                            onChange={(e) => setMoneyExtra(key, { price: e.target.value })}
                          />
                          <span className="ra-owner-listing__car-extra-unit">
                            {t(`owner.listing.carExtrasUnit.${unitKey}`)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {formCategory === 'motorcycle' && (
                <div className="ra-owner-listing__car-extras">
                  <h3 className="ra-owner-listing__h3">{t('owner.listing.motoExtrasTitle')}</h3>
                  <p className="ra-owner-listing__note ra-owner-listing__car-extras-intro">
                    {t('owner.listing.motoExtrasIntro')}
                  </p>
                  <div className="ra-owner-listing__car-extras-cols">
                    <div className="ra-owner-listing__car-extras-col">
                      {(
                        [
                          ['driverHelmet', 'eurPerDay'],
                          ['passengerHelmet', 'eurPerDay'],
                          ['padlock', 'eurPerDay'],
                          ['topCase', 'eurPerDay'],
                          ['navigation', 'eurPerDay'],
                          ['phoneHolder', 'eurPerDay'],
                        ] as const
                      ).map(([key, unitKey]) => (
                        <div key={key} className="ra-owner-listing__car-extra-row">
                          <input
                            type="checkbox"
                            checked={motorcycleExtras[key].on}
                            onChange={(e) => setMotoMoneyExtra(key, { on: e.target.checked })}
                            aria-label={t(`owner.listing.motoExtras.${key}`)}
                          />
                          <span className="ra-owner-listing__car-extra-label">
                            {t(`owner.listing.motoExtras.${key}`)}
                          </span>
                          <input
                            className="ra-owner-listing__car-extra-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={motorcycleExtras[key].price}
                            disabled={!motorcycleExtras[key].on}
                            onChange={(e) => setMotoMoneyExtra(key, { price: e.target.value })}
                          />
                          <span className="ra-owner-listing__car-extra-unit">
                            {t(`owner.listing.motoExtrasUnit.${unitKey}`)}
                          </span>
                        </div>
                      ))}
                      <div className="ra-owner-listing__moto-min-age">
                        <label className="ra-owner-listing__chk">
                          <input
                            type="checkbox"
                            checked={motorcycleExtras.minAgeExperience.on}
                            onChange={(e) =>
                              setMotorcycleExtras((p) => ({
                                ...p,
                                minAgeExperience: { ...p.minAgeExperience, on: e.target.checked },
                              }))
                            }
                          />
                          {t('owner.listing.motoExtras.minAgeExperience')}
                        </label>
                        <input
                          className="ra-owner-listing__car-extra-input"
                          type="text"
                          value={motorcycleExtras.minAgeExperience.text}
                          disabled={!motorcycleExtras.minAgeExperience.on}
                          onChange={(e) =>
                            setMotorcycleExtras((p) => ({
                              ...p,
                              minAgeExperience: { ...p.minAgeExperience, text: e.target.value },
                            }))
                          }
                          placeholder={t('owner.listing.motoMinAgePh')}
                        />
                        <label className="ra-owner-listing__chk ra-owner-listing__moto-by-agree">
                          <input
                            type="checkbox"
                            checked={motorcycleExtras.minAgeByAgreement}
                            onChange={(e) =>
                              setMotorcycleExtras((p) => ({
                                ...p,
                                minAgeByAgreement: e.target.checked,
                              }))
                            }
                          />
                          {t('owner.listing.motoExtras.byAgreement')}
                        </label>
                      </div>
                    </div>
                    <div className="ra-owner-listing__car-extras-col">
                      {(
                        [
                          ['hotelDelivery', 'eurPerRental'],
                          ['airportDelivery', 'eurPerRental'],
                          ['officeTransfer', 'eurPerRental'],
                          ['dropOff', 'eurPerRental'],
                        ] as const
                      ).map(([key, unitKey]) => (
                        <div key={key} className="ra-owner-listing__car-extra-row">
                          <input
                            type="checkbox"
                            checked={motorcycleExtras[key].on}
                            onChange={(e) => setMotoMoneyExtra(key, { on: e.target.checked })}
                            aria-label={t(`owner.listing.motoExtras.${key}`)}
                          />
                          <span className="ra-owner-listing__car-extra-label">
                            {t(`owner.listing.motoExtras.${key}`)}
                          </span>
                          <input
                            className="ra-owner-listing__car-extra-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={motorcycleExtras[key].price}
                            disabled={!motorcycleExtras[key].on}
                            onChange={(e) => setMotoMoneyExtra(key, { price: e.target.value })}
                          />
                          <span className="ra-owner-listing__car-extra-unit">
                            {t(`owner.listing.motoExtrasUnit.${unitKey}`)}
                          </span>
                        </div>
                      ))}
                      <div className="ra-owner-listing__car-extra-row">
                        <input
                          type="checkbox"
                          checked={motorcycleExtras.otherCityDelivery.on}
                          onChange={(e) =>
                            setMotoMoneyExtra('otherCityDelivery', { on: e.target.checked })
                          }
                          aria-label={t('owner.listing.motoExtras.otherCityDelivery')}
                        />
                        <span className="ra-owner-listing__car-extra-label">
                          {t('owner.listing.motoExtras.otherCityDelivery')}
                        </span>
                        <input
                          className="ra-owner-listing__car-extra-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={motorcycleExtras.otherCityDelivery.price}
                          disabled={!motorcycleExtras.otherCityDelivery.on}
                          onChange={(e) =>
                            setMotoMoneyExtra('otherCityDelivery', { price: e.target.value })
                          }
                        />
                        <span className="ra-owner-listing__car-extra-unit">
                          {t('owner.listing.motoExtrasUnit.eurPerRental')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {formCategory === 'accommodation' && (
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
                          {t(`owner.listing.featHeat.${o.id}`)}
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
                          {t(`owner.listing.featFurn.${o.id}`)}
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
                          {t(`owner.listing.featEquip.${o.id}`)}
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
                          {t(`owner.listing.featRule.${o.id}`)}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
                </div>

                <aside className="ra-owner-listing__main-split-right" aria-label={t('owner.listing.tabBasic')}>
                  <p className="ra-owner-listing__req">{t('owner.listing.titleDescRequired')}</p>
                  <p className="ra-owner-listing__hint ra-owner-listing__hint--auto-translate">
                    {t('owner.listing.autoTranslateHint')}
                  </p>
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
                      onChange={(e) => {
                        setTitles((p) => ({ ...p, [activeLang]: e.target.value }))
                        scheduleTranslate()
                      }}
                      onBlur={onTitleBlur}
                      placeholder={
                        formCategory === 'car'
                          ? t('owner.listing.phTitleCar')
                          : formCategory === 'motorcycle'
                            ? t('owner.listing.phTitleMoto')
                            : t('owner.listing.phTitle')
                      }
                    />
                  </label>
                  <label className="ra-fld">
                    <span>
                      {t('owner.listing.descField')} <span className="ra-req">*</span>
                    </span>
                    <textarea
                      rows={6}
                      className="ra-owner-listing__desc-ta"
                      value={descriptions[activeLang] ?? ''}
                      onChange={(e) => {
                        setDescriptions((p) => ({ ...p, [activeLang]: e.target.value }))
                        scheduleTranslate()
                      }}
                      onBlur={onDescBlur}
                      placeholder={
                        formCategory === 'car'
                          ? t('owner.listing.phDescCar')
                          : formCategory === 'motorcycle'
                            ? t('owner.listing.phDescMoto')
                            : t('owner.listing.phDesc')
                      }
                    />
                    {translating && (
                      <span className="ra-owner-listing__translating">{t('owner.listing.translating')}</span>
                    )}
                  </label>
                </aside>
              </div>
            </div>
          )}

          {tab === 'owners' && (
            <div className="ra-owner-listing__owners">
              <p>
                <span className="ra-req">*</span> {t('owner.listing.ownersSection')}
              </p>
              <p className="ra-owner-listing__hint">{t('owner.listing.ownersHint')}</p>
              <p className="ra-owner-listing__hint">{t('owner.listing.linkedHint')}</p>
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
              <label className="ra-owner-listing__social-consent ra-fld">
                <span className="ra-owner-listing__social-consent-label">
                  <input
                    type="checkbox"
                    checked={socialExportConsent}
                    onChange={(e) => setSocialExportConsent(e.target.checked)}
                  />
                  {t('owner.listing.socialConsent')}{' '}
                  {exportSocial && <span className="ra-req">*</span>}
                </span>
                <span className="ra-owner-listing__hint">{t('owner.listing.socialConsentHint')}</span>
              </label>
              <div className="ra-owner-table-wrap ra-owner-listing__table-scroll">
                <table className="ra-owner-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>{t('owner.listing.contactFirst')}</th>
                      <th>{t('owner.listing.contactLast')}</th>
                      <th>{t('owner.listing.contactType')}</th>
                      <th>{t('owner.listing.contactPhone')}</th>
                      <th>{t('owner.listing.contactEmail')}</th>
                      <th>{t('owner.listing.phoneScopeCol')}</th>
                      <th title={t('owner.listing.avatarAllListingsTitle')}>
                        {t('owner.listing.avatarAllListingsCol')}
                      </th>
                      <th>{t('owner.listing.showOnThisListing')}</th>
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
                          <select
                            className="ra-owner-table__scope"
                            value={c.phoneScope}
                            onChange={(e) => {
                              const v = e.target.value as ContactPhoneScope
                              setContacts((prev) => prev.map((row) => (row.id === c.id ? { ...row, phoneScope: v } : row)))
                            }}
                            aria-label={t('owner.listing.phoneScopeCol')}
                          >
                            <option value="this_listing">{t('owner.listing.phoneScopeThis')}</option>
                            <option value="all_listings">{t('owner.listing.phoneScopeAll')}</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={c.showAvatarOnAllListings === true}
                            onChange={(e) => {
                              const v = e.target.checked
                              setContacts((prev) => {
                                const next = prev.map((row) =>
                                  row.id === c.id ? { ...row, showAvatarOnAllListings: v } : row,
                                )
                                queueMicrotask(() => flushDraftRef.current?.(next))
                                return next
                              })
                            }}
                            aria-label={t('owner.listing.avatarAllListingsTitle')}
                            title={t('owner.listing.avatarAllListingsTitle')}
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={linkedContactIds.includes(c.id)}
                            onChange={() => toggleContactLinked(c.id)}
                            aria-label={t('owner.listing.showOnThisListing')}
                            title={t('owner.listing.showOnThisListing')}
                          />
                        </td>
                        <td>
                          <div className="ra-owner-table__actions">
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
                            <button
                              type="button"
                              className="ra-btn ra-btn--ghost ra-btn--sm"
                              disabled={c.type === 'owner'}
                              title={c.type === 'owner' ? t('owner.listing.cannotDeleteOwner') : undefined}
                              onClick={() => {
                                if (c.type === 'owner') return
                                if (!window.confirm(t('owner.listing.confirmDeleteContact'))) return
                                setContacts((prev) => prev.filter((row) => row.id !== c.id))
                                setLinkedContactIds((prev) => prev.filter((x) => x !== c.id))
                                if (contactPhotoContactId === c.id) setContactPhotoContactId(null)
                              }}
                            >
                              {t('owner.listing.deleteContact')}
                            </button>
                            <button
                              type="button"
                              className="ra-btn ra-btn--ghost ra-btn--sm"
                              disabled={c.type === 'owner' && c.showAvatarOnAllListings === true}
                              title={
                                c.type === 'owner' && c.showAvatarOnAllListings
                                  ? t('owner.listing.contactPhotoOwnerUseProfileInstead')
                                  : undefined
                              }
                              onClick={() => {
                                if (c.type === 'owner' && c.showAvatarOnAllListings) return
                                setContactPhotoContactId(c.id)
                              }}
                            >
                              {contactRowAvatarSrc(c) ? t('owner.listing.editContactPhoto') : t('owner.listing.addContactPhoto')}
                            </button>
                          </div>
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
              <p className="ra-owner-listing__hint">{t('owner.listing.imagesWebpNote')}</p>
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
                  <li
                    key={im.id}
                    data-thumb-i={i}
                    draggable={allowHtml5ThumbDrag}
                    className={`${thumbReorderFrom === i ? 'is-thumb-reorder-pick' : ''} ${thumbReorderHover === i && thumbReorderFrom !== null ? 'is-thumb-reorder-hover' : ''}`}
                    onDragStart={(e) => {
                      if (!allowHtml5ThumbDrag) return
                      e.dataTransfer.setData('text/plain', String(i))
                    }}
                    onDragOver={(e) => {
                      if (!allowHtml5ThumbDrag) return
                      e.preventDefault()
                    }}
                    onDrop={(e) => {
                      if (!allowHtml5ThumbDrag) return
                      e.preventDefault()
                      const from = Number(e.dataTransfer.getData('text/plain'))
                      if (Number.isNaN(from)) return
                      setImages((prev) => {
                        const n = [...prev]
                        const [item] = n.splice(from, 1)
                        n.splice(i, 0, item)
                        return n
                      })
                    }}
                    onTouchStart={(e) => onThumbTouchStart(i, e)}
                    onTouchMove={onThumbTouchMove}
                    onTouchEnd={onThumbLiTouchEndOrCancel}
                    onTouchCancel={onThumbLiTouchEndOrCancel}
                  >
                    <img
                      src={im.label}
                      alt=""
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                    />
                    <button
                      type="button"
                      className="ra-owner-listing__thumb-x"
                      onPointerDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onClick={() => setImages((p) => p.filter((x) => x.id !== im.id))}
                    >
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
                <label className="ra-owner-listing__export-single">
                  <input
                    type="checkbox"
                    checked={exportSocial}
                    onChange={(e) => setExportSocial(e.target.checked)}
                  />
                  {t('owner.listing.exportSocial')}
                </label>
              </fieldset>
              <p className="ra-owner-listing__note">{t('owner.listing.exportNote1')}</p>
              <p className="ra-owner-listing__hint">{t('owner.listing.exportNote2')}</p>
              {exportSocial && (
                <p className="ra-owner-listing__req ra-owner-listing__export-remind">{t('owner.listing.socialConsentExportRemind')}</p>
              )}
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
        </div>

        <footer className="ra-owner-listing__foot">
          <button type="button" className="ra-link-btn" onClick={() => setHelpOpen(true)}>
            {t('owner.listing.help')}
          </button>
          <div className="ra-owner-listing__foot-btns">
            <button
              type="button"
              className="ra-btn ra-btn--ghost"
              disabled={tab === 'basic'}
              onClick={goPrevTab}
            >
              {t('owner.listing.back')}
            </button>
            <button type="button" className="ra-btn ra-btn--primary" onClick={goNextTab}>
              {t('owner.listing.next')}
            </button>
            <button type="button" className="ra-btn ra-btn--primary" onClick={handleSave}>
              {t('owner.listing.save')}
            </button>
            <button type="button" className="ra-btn ra-btn--ghost" onClick={onClose}>
              {t('owner.listing.cancel')}
            </button>
          </div>
        </footer>
      </div>

      {contactPhotoContactId ? (
        <div
          className="ra-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-photo-title"
          onClick={() => setContactPhotoContactId(null)}
        >
          <div className="ra-modal__panel ra-contact-photo-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="ra-modal__close"
              onClick={() => setContactPhotoContactId(null)}
              aria-label={t('owner.listing.contactPhotoClose')}
            >
              ×
            </button>
            <h2 id="contact-photo-title" className="ra-contact-photo-modal__title">
              {t('owner.listing.contactPhotoTitle')}
            </h2>
            <p className="ra-contact-photo-modal__hint">{t('owner.listing.contactPhotoHint')}</p>
            <div className="ra-contact-photo-modal__preview">
              {contactPhotoRow && contactRowAvatarSrc(contactPhotoRow) ? (
                <img
                  src={contactRowAvatarSrc(contactPhotoRow)}
                  alt=""
                  className="ra-contact-photo-modal__img"
                  width={120}
                  height={120}
                />
              ) : (
                <div className="ra-contact-photo-modal__placeholder" aria-hidden />
              )}
            </div>
            <div className="ra-contact-photo-modal__actions">
              <button
                type="button"
                className="ra-btn ra-btn--ghost"
                disabled={contactPhotoBusy}
                onClick={() => contactPhotoFileRef.current?.click()}
              >
                {contactPhotoBusy ? t('owner.listing.contactPhotoUploading') : t('owner.listing.contactPhotoPick')}
              </button>
              {contactPhotoRow && contactRowAvatarSrc(contactPhotoRow) ? (
                <button
                  type="button"
                  className="ra-btn ra-btn--ghost"
                  disabled={contactPhotoBusy}
                  onClick={clearContactPhoto}
                >
                  {t('owner.listing.contactPhotoRemove')}
                </button>
              ) : null}
              <input
                ref={contactPhotoFileRef}
                type="file"
                accept="image/*"
                className="ra-owner-profile__file"
                onChange={(e) => void onContactPhotoFile(e.target.files)}
              />
            </div>
            <button
              type="button"
              className="ra-btn ra-btn--primary ra-contact-photo-modal__done"
              onClick={() => setContactPhotoContactId(null)}
            >
              {t('owner.listing.contactPhotoClose')}
            </button>
          </div>
        </div>
      ) : null}

      {helpOpen ? (
        <div
          className="ra-modal ra-modal--owner-help"
          role="dialog"
          aria-modal="true"
          aria-labelledby="owner-listing-help-title"
          onClick={(e) => {
            e.stopPropagation()
            setHelpOpen(false)
          }}
        >
          <div className="ra-modal__panel ra-owner-help-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="ra-modal__close" onClick={() => setHelpOpen(false)} aria-label="Close">
              ×
            </button>
            <h2 id="owner-listing-help-title" className="ra-owner-help-modal__title">
              {t('owner.listing.helpModalTitle')}
            </h2>
            <p className="ra-owner-help-modal__intro">{t('owner.listing.helpModalIntro')}</p>
            {tabs.map((x) => (
              <section key={x.id} className="ra-owner-help-modal__section">
                <h3>{x.label}</h3>
                <p>{t(`owner.listing.helpTab.${x.id}`)}</p>
              </section>
            ))}
            <div className="ra-owner-help-modal__actions">
              <button type="button" className="ra-btn ra-btn--primary" onClick={() => setHelpOpen(false)}>
                {t('owner.listing.helpModalOk')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {createPortal(
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
              const nid = `c-${Date.now()}`
              setContacts((prev) => [
                ...prev,
                {
                  id: nid,
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
                  phoneScope: 'this_listing',
                  showAvatarOnAllListings: false,
                },
              ])
              setLinkedContactIds((prev) => [...prev, nid])
            }
          }}
        />,
        document.body,
      )}
    </div>
  )
}
