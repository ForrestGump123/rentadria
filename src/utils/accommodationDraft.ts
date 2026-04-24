import type { TFunction } from 'i18next'
import type { Listing } from '../types'
import type { DetailPricePanel, ListingDetailExtra, OwnerContact } from '../types/listingDetail'
import type { SearchCountryId } from '../data/cities/countryIds'
import {
  EQUIPMENT_OPTS,
  FURNITURE_OPTS,
  HEATING_OPTS,
  RULES_OPTS,
} from '../constants/accommodationFeatures'
import {
  defaultCarListingExtras,
  normalizeCarListingExtras,
  type CarListingExtras,
} from '../constants/carListingExtras'
import {
  defaultMotorcycleListingExtras,
  normalizeMotorcycleListingExtras,
  type MotorcycleListingExtras,
} from '../constants/motorcycleListingExtras'
import { LISTING_LANG_IDS, type ListingLangId } from '../constants/ownerListingLangs'
import { listingPublicNumberFromId } from '../data/listingDetail'
import i18n from '../i18n'
import { formatDateDayMonthYear } from './dateDisplay'
import { getContactAvatarGlobal } from './contactAvatarGlobal'
import { getOwnerAvatarPublic, pullOwnerAvatarPublic } from './ownerAvatarPublic'
import { resolveOwnerUserIdForListing } from './visitorInquiries'

const PLACEHOLDER_IMG = 'https://picsum.photos/seed/rentadria-draft-placeholder/800/520'

export type BuildAccommodationDraftDetailOptions = {
  /** Ne stavljaj email/telefon/Telegram u objekt dok korisnik ne klikne „Prikaži kontakt“. */
  omitContactChannels?: boolean
}

function applyOmitContactChannels(
  contacts: OwnerContact[],
  omit: boolean | undefined,
): OwnerContact[] {
  if (!omit) return contacts
  return contacts.map((c) => ({
    ...c,
    email: '',
    phones: [],
    telegram: '',
  }))
}

export const ACCOMMODATION_DRAFT_LISTING_ID = 'owner-draft-accommodation'
export const ACCOMMODATION_DRAFT_LS_KEY = 'rentadria_listing_draft_accommodation'

/** Javni URL oglasa smještaja po redu u panelu vlasnika (`own-…-acc-…`). */
export const OWNER_ACCOMMODATION_DRAFT_ID_PREFIX = 'owner-draft-acc-'

export const CAR_DRAFT_LS_KEY = 'rentadria_listing_draft_car'
export const OWNER_CAR_DRAFT_ID_PREFIX = 'owner-draft-car-'

export const MOTO_DRAFT_LS_KEY = 'rentadria_listing_draft_motorcycle'
export const OWNER_MOTO_DRAFT_ID_PREFIX = 'owner-draft-moto-'

export function ownerAccommodationPublicListingId(ownerRowId: string): string {
  return `${OWNER_ACCOMMODATION_DRAFT_ID_PREFIX}${ownerRowId}`
}

export function ownerCarPublicListingId(ownerRowId: string): string {
  return `${OWNER_CAR_DRAFT_ID_PREFIX}${ownerRowId}`
}

export function ownerMotorcyclePublicListingId(ownerRowId: string): string {
  return `${OWNER_MOTO_DRAFT_ID_PREFIX}${ownerRowId}`
}

export function ownerRowIdFromAccommodationPublicListingId(listingId: string): string | null {
  if (!listingId.startsWith(OWNER_ACCOMMODATION_DRAFT_ID_PREFIX)) return null
  const rest = listingId.slice(OWNER_ACCOMMODATION_DRAFT_ID_PREFIX.length)
  return rest || null
}

export function ownerRowIdFromCarPublicListingId(listingId: string): string | null {
  if (!listingId.startsWith(OWNER_CAR_DRAFT_ID_PREFIX)) return null
  const rest = listingId.slice(OWNER_CAR_DRAFT_ID_PREFIX.length)
  return rest || null
}

export function ownerRowIdFromMotorcyclePublicListingId(listingId: string): string | null {
  if (!listingId.startsWith(OWNER_MOTO_DRAFT_ID_PREFIX)) return null
  const rest = listingId.slice(OWNER_MOTO_DRAFT_ID_PREFIX.length)
  return rest || null
}

export type DraftContactRow = {
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
  categories: string[]
  phoneScope: 'this_listing' | 'all_listings'
  /** Slika kontakta (data URL), za prikaz pored imena na oglasu. */
  avatarDataUrl?: string | null
  /** Nakon uploada na storage — draft ostaje mali (bez megabase64). */
  avatarUrl?: string | null
  /** Kada je uključeno, slika se vidi na svim oglasima (vlasnik: profil; kontakt: globalna mapa). */
  showAvatarOnAllListings?: boolean
}

export interface AccommodationListingDraft {
  /** Form type; legacy drafts omit this and are treated as accommodation. */
  formCategory?: 'accommodation' | 'car' | 'motorcycle'
  titles: Record<string, string>
  descriptions: Record<string, string>
  countryId: SearchCountryId | null
  city: string
  municipality: string
  district: string
  street: string
  streetNo: string
  apt: string
  propertyType: string
  structure: string
  areaM2: string
  floor: string
  bathrooms: string
  furnished: string
  priceEur: string
  pricePre: string
  priceSeason: string
  pricePost: string
  priceOff: string
  availableFrom: string
  payCashCard: boolean
  payCash: boolean
  payCard: boolean
  payBank: boolean
  featHeating: string[]
  featFurniture: string[]
  featEquipment: string[]
  featRules: string[]
  images: string[]
  exportSocial: boolean
  socialExportConsent: boolean
  contacts: DraftContactRow[]
  linkedContactIds: string[]
  contactVis: 'both' | 'email' | 'phone'
  lat: number | null
  lng: number | null
  carMake: string
  carModel: string
  carYear: string
  carFuel: string
  carEngineCc: string
  carMaxPassengers: string
  carDoors: string
  carTransmission: string
  carLuggageLarge: string
  carLuggageSmall: string
  carColor: string
  carSeatsNote: string
  /** Optional extras / surcharges for car rental (saved with car drafts). */
  carExtras?: CarListingExtras
  /** Optional extras for motorcycle rental. */
  motorcycleExtras?: MotorcycleListingExtras
}

export function draftFormCategory(d: AccommodationListingDraft): 'accommodation' | 'car' | 'motorcycle' {
  if (d.formCategory === 'car') return 'car'
  if (d.formCategory === 'motorcycle') return 'motorcycle'
  return 'accommodation'
}

export function isAccommodationDraftListingId(id: string): boolean {
  return (
    id === ACCOMMODATION_DRAFT_LISTING_ID ||
    id.startsWith(OWNER_ACCOMMODATION_DRAFT_ID_PREFIX) ||
    id.startsWith(OWNER_CAR_DRAFT_ID_PREFIX) ||
    id.startsWith(OWNER_MOTO_DRAFT_ID_PREFIX)
  )
}

/**
 * Red-specifični nacrt i globalni `rentadria_listing_draft_accommodation` mogu biti kratko
 * razdvojeni (npr. slika kontakta samo u globalnom dok nije ponovo Sačuvaj). Spoji avatarDataUrl / avatarUrl.
 */
function mergeDraftContactsAvatarFallback(
  primary: AccommodationListingDraft,
  fallback: AccommodationListingDraft | null,
): AccommodationListingDraft {
  if (!fallback?.contacts?.length) return primary
  const fb = new Map(fallback.contacts.map((c) => [c.id, c]))
  let changed = false
  const contacts = primary.contacts.map((c) => {
    const f = fb.get(c.id)
    if (!f) return c
    const hasP = Boolean(c.avatarDataUrl?.trim()) || Boolean(c.avatarUrl?.trim())
    const hasF = Boolean(f.avatarDataUrl?.trim()) || Boolean(f.avatarUrl?.trim())
    const pAll = c.showAvatarOnAllListings
    const fAll = f.showAvatarOnAllListings
    const mergeAll =
      pAll === undefined && fAll !== undefined ? { showAvatarOnAllListings: fAll } : {}
    if (!hasP && hasF) {
      changed = true
      return {
        ...c,
        avatarDataUrl: f.avatarDataUrl ?? null,
        avatarUrl: f.avatarUrl ?? null,
        ...mergeAll,
      }
    }
    if (Object.keys(mergeAll).length) {
      changed = true
      return { ...c, ...mergeAll }
    }
    return c
  })
  if (!changed) return primary
  return { ...primary, contacts }
}

/** Nacrt za stranicu oglasa: globalni zadnji nacrt ili LS ključ vezan za red vlasnika. */
export function loadAccommodationDraftForPublicListingPage(listingId: string): AccommodationListingDraft | null {
  if (listingId === ACCOMMODATION_DRAFT_LISTING_ID) {
    return loadAccommodationDraft()
  }
  const rowIdAcc = ownerRowIdFromAccommodationPublicListingId(listingId)
  if (rowIdAcc) {
    const rowKey = `${ACCOMMODATION_DRAFT_LS_KEY}::${rowIdAcc}`
    const rowDraft = loadAccommodationDraft(rowKey)
    const globalDraft = loadAccommodationDraft()
    const base = rowDraft ?? globalDraft
    if (base && globalDraft) {
      return mergeDraftContactsAvatarFallback(base, globalDraft)
    }
    if (base) return base
  }
  const rowIdCar = ownerRowIdFromCarPublicListingId(listingId)
  if (rowIdCar) {
    return loadAccommodationDraft(`${CAR_DRAFT_LS_KEY}::${rowIdCar}`)
  }
  const rowIdMoto = ownerRowIdFromMotorcyclePublicListingId(listingId)
  if (rowIdMoto) {
    return loadAccommodationDraft(`${MOTO_DRAFT_LS_KEY}::${rowIdMoto}`)
  }
  return loadAccommodationDraft()
}

export function loadAccommodationDraft(
  lsKey: string = ACCOMMODATION_DRAFT_LS_KEY,
): AccommodationListingDraft | null {
  try {
    const raw = localStorage.getItem(lsKey)
    if (!raw) return null
    const p = JSON.parse(raw) as Record<string, unknown>
    if (!p || typeof p !== 'object') return null
    const titles = p.titles as Record<string, string> | undefined
    if (!titles || typeof titles !== 'object') return null
    const city = typeof p.city === 'string' ? p.city : ''
    const legacyIg = !!(p as { exportIg?: boolean }).exportIg
    const legacyFb = !!(p as { exportFb?: boolean }).exportFb
    const exportSocial =
      typeof p.exportSocial === 'boolean' ? p.exportSocial : legacyIg || legacyFb
    const contacts = Array.isArray(p.contacts)
      ? (p.contacts as DraftContactRow[])
      : []
    const linked =
      Array.isArray(p.linkedContactIds) && p.linkedContactIds.length > 0
        ? (p.linkedContactIds as string[])
        : contacts.filter((c) => c.type === 'owner').map((c) => c.id).length
          ? contacts.filter((c) => c.type === 'owner').map((c) => c.id)
          : contacts.length
            ? [contacts[0]!.id]
            : []
    const formCat =
      p.formCategory === 'car'
        ? 'car'
        : p.formCategory === 'motorcycle'
          ? 'motorcycle'
          : 'accommodation'
    return {
      formCategory: formCat,
      titles,
      descriptions: (p.descriptions as Record<string, string>) ?? {},
      countryId: (p.countryId as SearchCountryId | null) ?? null,
      city,
      municipality: typeof p.municipality === 'string' ? p.municipality : '',
      district: typeof p.district === 'string' ? p.district : '',
      street: typeof p.street === 'string' ? p.street : '',
      streetNo: typeof p.streetNo === 'string' ? p.streetNo : '',
      apt: typeof p.apt === 'string' ? p.apt : '',
      propertyType: typeof p.propertyType === 'string' ? p.propertyType : '',
      structure: typeof p.structure === 'string' ? p.structure : '',
      areaM2: typeof p.areaM2 === 'string' ? p.areaM2 : '',
      floor: typeof p.floor === 'string' ? p.floor : '',
      bathrooms: typeof p.bathrooms === 'string' ? p.bathrooms : '',
      furnished: typeof p.furnished === 'string' ? p.furnished : '',
      priceEur: typeof p.priceEur === 'string' ? p.priceEur : '',
      pricePre: typeof p.pricePre === 'string' ? p.pricePre : '',
      priceSeason: typeof p.priceSeason === 'string' ? p.priceSeason : '',
      pricePost: typeof p.pricePost === 'string' ? p.pricePost : '',
      priceOff: typeof p.priceOff === 'string' ? p.priceOff : '',
      availableFrom: typeof p.availableFrom === 'string' ? p.availableFrom : '',
      payCashCard: !!(p as { payCashCard?: boolean }).payCashCard,
      payCash: !!(p as { payCash?: boolean }).payCash,
      payCard: !!(p as { payCard?: boolean }).payCard,
      payBank: !!(p as { payBank?: boolean }).payBank,
      featHeating: Array.isArray(p.featHeating) ? (p.featHeating as string[]) : [],
      featFurniture: Array.isArray(p.featFurniture) ? (p.featFurniture as string[]) : [],
      featEquipment: Array.isArray(p.featEquipment) ? (p.featEquipment as string[]) : [],
      featRules: Array.isArray(p.featRules) ? (p.featRules as string[]) : [],
      images: Array.isArray(p.images) ? (p.images as string[]) : [],
      exportSocial,
      socialExportConsent: !!(p as { socialExportConsent?: boolean }).socialExportConsent,
      contacts,
      linkedContactIds: linked.length ? linked : ['owner-1'],
      contactVis: ['both', 'email', 'phone'].includes(String(p.contactVis))
        ? (p.contactVis as 'both' | 'email' | 'phone')
        : 'both',
      lat: typeof p.lat === 'number' ? p.lat : null,
      lng: typeof p.lng === 'number' ? p.lng : null,
      carMake: typeof p.carMake === 'string' ? p.carMake : '',
      carModel: typeof p.carModel === 'string' ? p.carModel : '',
      carYear: typeof p.carYear === 'string' ? p.carYear : '',
      carFuel: typeof p.carFuel === 'string' ? p.carFuel : '',
      carEngineCc: typeof p.carEngineCc === 'string' ? p.carEngineCc : '',
      carMaxPassengers: typeof p.carMaxPassengers === 'string' ? p.carMaxPassengers : '',
      carDoors: typeof p.carDoors === 'string' ? p.carDoors : '',
      carTransmission: typeof p.carTransmission === 'string' ? p.carTransmission : '',
      carLuggageLarge: typeof p.carLuggageLarge === 'string' ? p.carLuggageLarge : '',
      carLuggageSmall: typeof p.carLuggageSmall === 'string' ? p.carLuggageSmall : '',
      carColor: typeof p.carColor === 'string' ? p.carColor : '',
      carSeatsNote: typeof p.carSeatsNote === 'string' ? p.carSeatsNote : '',
      carExtras: normalizeCarListingExtras(p.carExtras),
      motorcycleExtras: normalizeMotorcycleListingExtras(p.motorcycleExtras),
    }
  } catch {
    return null
  }
}

/** Preferuje nacrt vezan za red u vlasničkoj tablici; inače globalni nacrt (pregled). */
export function loadAccommodationDraftForEdit(
  ownerRowId: string | null | undefined,
): AccommodationListingDraft | null {
  if (ownerRowId) {
    const rowDraft = loadAccommodationDraft(`${ACCOMMODATION_DRAFT_LS_KEY}::${ownerRowId}`)
    if (rowDraft) return rowDraft
  }
  return loadAccommodationDraft()
}

export function loadOwnerListingDraftForEdit(
  formCategory: 'accommodation' | 'car' | 'motorcycle',
  ownerRowId: string | null | undefined,
): AccommodationListingDraft | null {
  if (formCategory === 'car') {
    if (!ownerRowId) return null
    return loadAccommodationDraft(`${CAR_DRAFT_LS_KEY}::${ownerRowId}`)
  }
  if (formCategory === 'motorcycle') {
    if (!ownerRowId) return null
    return loadAccommodationDraft(`${MOTO_DRAFT_LS_KEY}::${ownerRowId}`)
  }
  return loadAccommodationDraftForEdit(ownerRowId)
}

export function hasAccommodationDraft(): boolean {
  return loadAccommodationDraft() !== null
}

/** Keeps draft preview in sync after auto-translate (without requiring Save). */
export function mergeAccommodationDraftTexts(
  titles: Record<string, string>,
  descriptions: Record<string, string>,
  ownerRowId?: string | null,
  formCategory: 'accommodation' | 'car' | 'motorcycle' = 'accommodation',
): void {
  const baseKey =
    formCategory === 'car'
      ? CAR_DRAFT_LS_KEY
      : formCategory === 'motorcycle'
        ? MOTO_DRAFT_LS_KEY
        : ACCOMMODATION_DRAFT_LS_KEY
  const rowKey = ownerRowId ? `${baseKey}::${ownerRowId}` : null
  const cur =
    (rowKey && loadAccommodationDraft(rowKey)) ||
    (formCategory === 'accommodation' ? loadAccommodationDraft() : null)
  if (!cur) return
  const next: AccommodationListingDraft = {
    ...cur,
    titles: { ...cur.titles, ...titles },
    descriptions: { ...cur.descriptions, ...descriptions },
  }
  const json = JSON.stringify(next)
  try {
    if (formCategory === 'accommodation') {
      localStorage.setItem(ACCOMMODATION_DRAFT_LS_KEY, json)
    }
    if (rowKey) {
      localStorage.setItem(rowKey, json)
    }
  } catch {
    /* ignore */
  }
}

/** Balkan UI langs share cnr/sr/bs/hr draft fields before falling back to en. */
const BALKAN_UI = new Set(['cnr', 'sr', 'hr', 'bs'])

const BALKAN_CLUSTER: Record<string, ListingLangId[]> = {
  cnr: ['cnr', 'sr', 'bs', 'hr'],
  sr: ['sr', 'cnr', 'bs', 'hr'],
  bs: ['bs', 'cnr', 'sr', 'hr'],
  hr: ['hr', 'cnr', 'sr', 'bs'],
}

function buildDraftLangPickOrder(uiLang: string): ListingLangId[] {
  const base = (uiLang.split('-')[0] ?? 'en') as string
  const cluster: ListingLangId[] = BALKAN_CLUSTER[base]
    ? BALKAN_CLUSTER[base]
    : LISTING_LANG_IDS.includes(base as ListingLangId)
      ? [base as ListingLangId]
      : ['en']
  const seen = new Set<string>(cluster)
  const order: ListingLangId[] = [...cluster]

  const restTail: ListingLangId[] = BALKAN_UI.has(base)
    ? ['en', 'sq', 'it', 'es']
    : base === 'en'
      ? ['sq', 'it', 'es', 'cnr', 'sr', 'hr', 'bs']
      : (['en', 'sq', 'it', 'es', 'cnr', 'sr', 'hr', 'bs'] as ListingLangId[])

  for (const k of restTail) {
    if (LISTING_LANG_IDS.includes(k) && !seen.has(k)) {
      seen.add(k)
      order.push(k)
    }
  }
  for (const k of LISTING_LANG_IDS) {
    if (!seen.has(k)) {
      seen.add(k)
      order.push(k)
    }
  }
  return order
}

/** Picks title/description for the **current site language**; avoids showing English when CG/SR/… has text. */
export function pickDraftLangString(record: Record<string, string>, lang: string): string {
  const baseKey = lang.split('-')[0] ?? 'en'
  if (record[baseKey]?.trim()) return record[baseKey].trim()
  for (const k of buildDraftLangPickOrder(lang)) {
    const v = record[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  const first = Object.values(record).find((v) => typeof v === 'string' && v.trim())
  return first?.trim() ?? '—'
}

function euroLabel(raw: string): string {
  const s = raw.trim()
  if (!s) return '—'
  if (/€/.test(s)) return s
  return `€${s}`
}

export function listingFromAccommodationDraft(
  d: AccommodationListingDraft,
  listingId: string = ACCOMMODATION_DRAFT_LISTING_ID,
): Listing {
  const countryPart =
    d.countryId != null ? i18n.t(`search.country_${d.countryId}`) : ''
  const loc =
    d.city.trim() && countryPart
      ? `${d.city.trim()}, ${countryPart}`
      : d.city.trim() || countryPart || '—'

  const title = pickDraftLangString(d.titles, i18n.language)
  const img = d.images[0] ?? PLACEHOLDER_IMG
  const price = d.priceEur.trim() ? `€${d.priceEur.trim()}` : '—'

  const isVeh = d.formCategory === 'car' || d.formCategory === 'motorcycle'
  return {
    id: listingId,
    category:
      d.formCategory === 'car' ? 'car' : d.formCategory === 'motorcycle' ? 'motorcycle' : 'accommodation',
    title,
    titleSlot: 0,
    location: loc,
    priceLabel: price,
    image: img,
    createdAt: new Date().toISOString(),
    verified: false,
    ownerPropertyType: !isVeh && d.propertyType ? d.propertyType : undefined,
    ownerVehicleMake: isVeh && d.carMake.trim() ? d.carMake.trim() : undefined,
  }
}

/** Kad red još nije u mapi oglasa, userId je u id-u reda `own-{userId}-acc-…`. */
function parseOwnerUserIdFromDraftListingId(listingId: string): string | null {
  const acc = ownerRowIdFromAccommodationPublicListingId(listingId)
  if (acc) {
    const m = /^own-(.+)-acc-\d+$/.exec(acc)
    if (m?.[1]) return m[1]!
  }
  const car = ownerRowIdFromCarPublicListingId(listingId)
  if (car) {
    const m = /^own-(.+)-car-\d+$/.exec(car)
    if (m?.[1]) return m[1]!
  }
  const moto = ownerRowIdFromMotorcyclePublicListingId(listingId)
  if (moto) {
    const m = /^own-(.+)-moto-\d+$/.exec(moto)
    if (m?.[1]) return m[1]!
  }
  return null
}

function resolveOwnerUserIdForDraftDetail(publicListingId?: string): string | null {
  if (!publicListingId) return null
  return resolveOwnerUserIdForListing(publicListingId) ?? parseOwnerUserIdFromDraftListingId(publicListingId)
}

function listingOwnerAvatarUrl(publicListingId?: string): string | undefined {
  if (!publicListingId) return undefined
  const uid = resolveOwnerUserIdForDraftDetail(publicListingId)
  if (!uid) return undefined
  const url = getOwnerAvatarPublic(uid)
  if (!url) void pullOwnerAvatarPublic(uid)
  return url ?? undefined
}

type DraftContactCtx = {
  ownerUserId: string | null
}

function draftContactToOwner(
  row: DraftContactRow,
  vis: 'both' | 'email' | 'phone',
  ctx: DraftContactCtx,
  ownerAvatarUrl?: string | null,
): OwnerContact {
  const showPhone = vis !== 'email'
  const showEmail = vis !== 'phone'
  const phones: { display: string; e164: string }[] = []
  if (showPhone && row.phone.trim()) {
    const digits = row.phone.replace(/\D/g, '')
    if (digits) {
      const e164 = row.phone.trim().startsWith('+')
        ? row.phone.trim().replace(/\s/g, '')
        : `+${digits}`
      phones.push({ display: row.phone.trim(), e164 })
    }
  }
  let tg = (row.telegram || '').trim()
  if (tg.startsWith('@')) tg = tg.slice(1)
  const base: OwnerContact = {
    displayName: `${row.firstName} ${row.lastName}`.trim() || '—',
    email: showEmail ? row.email.trim() : '',
    phones,
    telegram: tg,
  }
  const rowAv = (row.avatarUrl?.trim() || row.avatarDataUrl?.trim() || '').trim()
  const allListings = row.showAvatarOnAllListings === true

  if (row.type === 'owner') {
    if (allListings && ctx.ownerUserId) {
      const prof = getOwnerAvatarPublic(ctx.ownerUserId)
      if (!prof) void pullOwnerAvatarPublic(ctx.ownerUserId)
      if (prof) return { ...base, avatarUrl: prof }
    }
    const av = rowAv || ownerAvatarUrl?.trim() || ''
    if (av) return { ...base, avatarUrl: av }
    return base
  }
  if (row.type === 'contact') {
    let av = ''
    if (allListings && ctx.ownerUserId) {
      av = getContactAvatarGlobal(ctx.ownerUserId, row.id) || rowAv
    } else {
      av = rowAv
    }
    if (av) return { ...base, avatarUrl: av }
    return base
  }
  return base
}

function ptLabel(t: TFunction, v: string): string {
  if (!v) return '—'
  const key = `owner.listing.pt.${v}`
  const tr = t(key)
  return tr === key ? v : tr
}

function strLabel(t: TFunction, v: string): string {
  if (!v) return '—'
  const id = v === 'layout_studio' ? 'layoutStudio' : v
  const key = `owner.listing.str.${id}`
  const tr = t(key)
  return tr === key ? v : tr
}

function carEnumLabel(t: TFunction, prefix: string, v: string): string {
  if (!v) return '—'
  const key = `${prefix}.${v}`
  const tr = t(key)
  return tr === key ? v : tr
}

function carExtrasDisplayLines(ex: CarListingExtras, t: TFunction): string[] {
  const items: string[] = []
  const free = t('owner.listing.carExtrasIncludedFree')

  const isZeroPrice = (s: string) => {
    const x = s.trim().replace(',', '.')
    if (x === '') return true
    const n = Number(x)
    return !Number.isNaN(n) && n === 0
  }

  if (ex.dailyKmLimit.on) {
    const km = ex.dailyKmLimit.km.trim()
    if (!km || km === '0') {
      items.push(
        `${t('owner.listing.carExtras.dailyKmLimit')}: ${t('owner.listing.carExtrasUnlimitedKm')}`,
      )
    } else {
      items.push(
        `${t('owner.listing.carExtras.dailyKmLimit')}: ${km} ${t('owner.listing.carExtrasUnit.kmPerDay')}`,
      )
    }
  }

  const pushMoney = (
    line: { on: boolean; price: string },
    labelKey:
      | 'extraKm'
      | 'airportTax'
      | 'theftCoverage'
      | 'vat21'
      | 'babySeat'
      | 'boosterSeat'
      | 'scdw'
      | 'damageCoverage'
      | 'winterTires'
      | 'extraDriver'
      | 'childSeat'
      | 'crossBorder'
      | 'gps',
    unitKey: 'eurPerDay' | 'eurPerKm' | 'eurPerRental',
  ) => {
    if (!line.on) return
    const label = t(`owner.listing.carExtras.${labelKey}`)
    const unit = t(`owner.listing.carExtrasUnit.${unitKey}`)
    if (isZeroPrice(line.price)) {
      items.push(`${label} — ${free} (${unit})`)
    } else {
      items.push(`${label}: €${line.price.trim()} ${unit}`)
    }
  }

  pushMoney(ex.extraKm, 'extraKm', 'eurPerKm')
  pushMoney(ex.airportTax, 'airportTax', 'eurPerDay')
  pushMoney(ex.theftCoverage, 'theftCoverage', 'eurPerDay')
  pushMoney(ex.vat21, 'vat21', 'eurPerDay')
  pushMoney(ex.babySeat, 'babySeat', 'eurPerDay')
  pushMoney(ex.boosterSeat, 'boosterSeat', 'eurPerDay')
  pushMoney(ex.scdw, 'scdw', 'eurPerDay')
  pushMoney(ex.damageCoverage, 'damageCoverage', 'eurPerDay')
  pushMoney(ex.winterTires, 'winterTires', 'eurPerDay')
  pushMoney(ex.extraDriver, 'extraDriver', 'eurPerDay')
  pushMoney(ex.childSeat, 'childSeat', 'eurPerDay')
  pushMoney(ex.crossBorder, 'crossBorder', 'eurPerRental')
  pushMoney(ex.gps, 'gps', 'eurPerDay')

  if (ex.airConditioning.on) {
    items.push(`${t('owner.listing.carExtras.airConditioning')} — ${free}`)
  }

  return items
}

function motorcycleExtrasDisplayLines(ex: MotorcycleListingExtras, t: TFunction): string[] {
  const items: string[] = []
  const free = t('owner.listing.carExtrasIncludedFree')

  const isZeroPrice = (s: string) => {
    const x = s.trim().replace(',', '.')
    if (x === '') return true
    const n = Number(x)
    return !Number.isNaN(n) && n === 0
  }

  type DayKey =
    | 'driverHelmet'
    | 'passengerHelmet'
    | 'padlock'
    | 'topCase'
    | 'navigation'
    | 'phoneHolder'

  const dayKeys: DayKey[] = [
    'driverHelmet',
    'passengerHelmet',
    'padlock',
    'topCase',
    'navigation',
    'phoneHolder',
  ]

  for (const key of dayKeys) {
    const line = ex[key]
    if (!line.on) continue
    const label = t(`owner.listing.motoExtras.${key}`)
    const unit = t('owner.listing.motoExtrasUnit.eurPerDay')
    if (isZeroPrice(line.price)) {
      items.push(`${label} — ${free} (${unit})`)
    } else {
      items.push(`${label}: €${line.price.trim()} (${unit})`)
    }
  }

  type RentalKey =
    | 'hotelDelivery'
    | 'airportDelivery'
    | 'officeTransfer'
    | 'dropOff'

  const rentalKeys: RentalKey[] = ['hotelDelivery', 'airportDelivery', 'officeTransfer', 'dropOff']

  for (const key of rentalKeys) {
    const line = ex[key]
    if (!line.on) continue
    const label = t(`owner.listing.motoExtras.${key}`)
    const unit = t('owner.listing.motoExtrasUnit.eurPerRental')
    if (isZeroPrice(line.price)) {
      items.push(`${label} — ${free} (${unit})`)
    } else {
      items.push(`${label}: €${line.price.trim()} (${unit})`)
    }
  }

  if (ex.otherCityDelivery.on) {
    const label = t('owner.listing.motoExtras.otherCityDelivery')
    const unit = t('owner.listing.motoExtrasUnit.eurPerRental')
    if (isZeroPrice(ex.otherCityDelivery.price)) {
      items.push(`${label} — ${free} (${unit})`)
    } else {
      items.push(`${label}: €${ex.otherCityDelivery.price.trim()} (${unit})`)
    }
  }

  if (ex.minAgeExperience.on || ex.minAgeByAgreement) {
    const bits: string[] = []
    if (ex.minAgeExperience.on && ex.minAgeExperience.text.trim()) {
      bits.push(
        `${t('owner.listing.motoExtras.minAgeExperience')}: ${ex.minAgeExperience.text.trim()}`,
      )
    }
    if (ex.minAgeByAgreement) {
      bits.push(t('owner.listing.motoExtras.byAgreement'))
    }
    if (bits.length) items.push(bits.join(' — '))
  }

  return items
}

function buildMotorcycleDraftDetail(
  d: AccommodationListingDraft,
  t: TFunction,
  uiLang: string,
  publicListingId?: string,
  opts?: BuildAccommodationDraftDetailOptions,
): ListingDetailExtra {
  const desc = pickDraftLangString(d.descriptions, uiLang)

  const payBits: string[] = []
  if (d.payCashCard) payBits.push(t('owner.listing.payCashCard'))
  if (d.payCash) payBits.push(t('owner.listing.payCash'))
  if (d.payCard) payBits.push(t('owner.listing.payCard'))
  if (d.payBank) payBits.push(t('owner.listing.payBank'))

  const seasonal: { label: string; value: string }[] = []
  if (d.pricePre.trim()) seasonal.push({ label: t('owner.listing.pricePre'), value: euroLabel(d.pricePre) })
  if (d.priceSeason.trim()) seasonal.push({ label: t('owner.listing.priceIn'), value: euroLabel(d.priceSeason) })
  if (d.pricePost.trim()) seasonal.push({ label: t('owner.listing.pricePost'), value: euroLabel(d.pricePost) })
  if (d.priceOff.trim()) seasonal.push({ label: t('owner.listing.priceOff'), value: euroLabel(d.priceOff) })

  const paymentSummary = payBits.join(', ')
  const hasMainPrice = Boolean(d.priceEur.trim())
  let pricePanel: DetailPricePanel | undefined
  if (paymentSummary || hasMainPrice || seasonal.length > 0 || d.availableFrom.trim()) {
    pricePanel = {
      paymentSummary,
      mainPriceDisplay: hasMainPrice ? euroLabel(d.priceEur) : '',
      mainPriceSuffix: t('detail.prices.perDay'),
      seasonal,
      availableFrom: d.availableFrom.trim()
        ? formatDateDayMonthYear(d.availableFrom.trim())
        : undefined,
    }
  }

  const pricesLines: string[] = []
  if (d.priceEur.trim()) {
    pricesLines.push(`${t('owner.listing.priceDailyMain')}: €${d.priceEur.trim()}`)
  }
  if (d.pricePre.trim() || d.priceSeason.trim() || d.pricePost.trim() || d.priceOff.trim()) {
    if (d.pricePre.trim()) pricesLines.push(`${t('owner.listing.pricePre')}: ${d.pricePre.trim()}`)
    if (d.priceSeason.trim()) pricesLines.push(`${t('owner.listing.priceIn')}: ${d.priceSeason.trim()}`)
    if (d.pricePost.trim()) pricesLines.push(`${t('owner.listing.pricePost')}: ${d.pricePost.trim()}`)
    if (d.priceOff.trim()) pricesLines.push(`${t('owner.listing.priceOff')}: ${d.priceOff.trim()}`)
  }
  if (payBits.length) {
    pricesLines.push(`${t('owner.listing.payment')}: ${payBits.join(', ')}`)
  }
  if (d.availableFrom.trim()) {
    pricesLines.push(
      `${t('owner.listing.availableFrom')}: ${formatDateDayMonthYear(d.availableFrom.trim())}`,
    )
  }

  const basicInfo: { label: string; value: string }[] = [
    { label: t('owner.listing.carMake'), value: d.carMake.trim() || '—' },
    { label: t('owner.listing.carModel'), value: d.carModel.trim() || '—' },
    { label: t('owner.listing.carEngineCc'), value: d.carEngineCc.trim() ? `${d.carEngineCc} cm³` : '—' },
    { label: t('owner.listing.carYear'), value: d.carYear.trim() || '—' },
    { label: t('owner.listing.carFuel'), value: carEnumLabel(t, 'owner.listing.carFuelOpt', d.carFuel) },
    { label: t('owner.listing.carColor'), value: d.carColor.trim() || '—' },
    {
      label: t('owner.listing.carTransmission'),
      value: carEnumLabel(t, 'owner.listing.carGear', d.carTransmission),
    },
  ]

  const ownerAv = listingOwnerAvatarUrl(publicListingId)
  const draftContactCtx: DraftContactCtx = {
    ownerUserId: resolveOwnerUserIdForDraftDetail(publicListingId),
  }
  const linked = new Set(d.linkedContactIds)
  const publicContacts = d.contacts
    .filter((c) => linked.has(c.id))
    .map((c) => draftContactToOwner(c, d.contactVis, draftContactCtx, c.type === 'owner' ? ownerAv : null))

  const fallbackName = pickDraftLangString(d.titles, uiLang)
  const safeContacts =
    publicContacts.length > 0
      ? publicContacts
      : [
          {
            displayName: fallbackName,
            email: '',
            phones: [],
            telegram: '',
          },
        ]

  const gallery = d.images.length > 0 ? d.images : [PLACEHOLDER_IMG]

  const mapLat = d.lat ?? 42.4247
  const mapLng = d.lng ?? 18.7712
  const countryPart =
    d.countryId != null ? i18n.t(`search.country_${d.countryId}`) : ''
  const mapLabel =
    d.city.trim() && countryPart
      ? `${d.city.trim()}, ${countryPart}`
      : d.city.trim() || countryPart || '—'

  const extraLines = motorcycleExtrasDisplayLines(
    d.motorcycleExtras ?? defaultMotorcycleListingExtras(),
    t,
  )
  const characteristicGroups =
    extraLines.length > 0
      ? [{ title: t('owner.listing.motoExtrasTitle'), items: extraLines }]
      : []

  const lid = publicListingId ?? ''
  return {
    rating: 0,
    listingNumber: listingPublicNumberFromId(lid),
    viewCount: 0,
    updatedAt: new Date().toLocaleDateString('en-GB'),
    gallery,
    basicInfo,
    description: desc,
    characteristics: extraLines,
    characteristicGroups,
    pricesAndPayment: pricesLines.length ? pricesLines.join('\n') : '—',
    pricePanel,
    publicContacts: applyOmitContactChannels(safeContacts, opts?.omitContactChannels),
    contactVisibility: d.contactVis,
    mapLat,
    mapLng,
    mapLabel,
    descriptionIsPlain: true,
    characteristicsArePlain: true,
    pricesArePlain: true,
  }
}

function buildCarDraftDetail(
  d: AccommodationListingDraft,
  t: TFunction,
  uiLang: string,
  publicListingId?: string,
  opts?: BuildAccommodationDraftDetailOptions,
): ListingDetailExtra {
  const desc = pickDraftLangString(d.descriptions, uiLang)

  const payBits: string[] = []
  if (d.payCashCard) payBits.push(t('owner.listing.payCashCard'))
  if (d.payCash) payBits.push(t('owner.listing.payCash'))
  if (d.payCard) payBits.push(t('owner.listing.payCard'))
  if (d.payBank) payBits.push(t('owner.listing.payBank'))

  const seasonal: { label: string; value: string }[] = []
  if (d.pricePre.trim()) seasonal.push({ label: t('owner.listing.pricePre'), value: euroLabel(d.pricePre) })
  if (d.priceSeason.trim()) seasonal.push({ label: t('owner.listing.priceIn'), value: euroLabel(d.priceSeason) })
  if (d.pricePost.trim()) seasonal.push({ label: t('owner.listing.pricePost'), value: euroLabel(d.pricePost) })
  if (d.priceOff.trim()) seasonal.push({ label: t('owner.listing.priceOff'), value: euroLabel(d.priceOff) })

  const paymentSummary = payBits.join(', ')
  const hasMainPrice = Boolean(d.priceEur.trim())
  let pricePanel: DetailPricePanel | undefined
  if (paymentSummary || hasMainPrice || seasonal.length > 0 || d.availableFrom.trim()) {
    pricePanel = {
      paymentSummary,
      mainPriceDisplay: hasMainPrice ? euroLabel(d.priceEur) : '',
      mainPriceSuffix: t('detail.prices.perDay'),
      seasonal,
      availableFrom: d.availableFrom.trim()
        ? formatDateDayMonthYear(d.availableFrom.trim())
        : undefined,
    }
  }

  const pricesLines: string[] = []
  if (d.priceEur.trim()) {
    pricesLines.push(`${t('owner.listing.priceDailyMain')}: €${d.priceEur.trim()}`)
  }
  if (d.pricePre.trim() || d.priceSeason.trim() || d.pricePost.trim() || d.priceOff.trim()) {
    if (d.pricePre.trim()) pricesLines.push(`${t('owner.listing.pricePre')}: ${d.pricePre.trim()}`)
    if (d.priceSeason.trim()) pricesLines.push(`${t('owner.listing.priceIn')}: ${d.priceSeason.trim()}`)
    if (d.pricePost.trim()) pricesLines.push(`${t('owner.listing.pricePost')}: ${d.pricePost.trim()}`)
    if (d.priceOff.trim()) pricesLines.push(`${t('owner.listing.priceOff')}: ${d.priceOff.trim()}`)
  }
  if (payBits.length) {
    pricesLines.push(`${t('owner.listing.payment')}: ${payBits.join(', ')}`)
  }
  if (d.availableFrom.trim()) {
    pricesLines.push(
      `${t('owner.listing.availableFrom')}: ${formatDateDayMonthYear(d.availableFrom.trim())}`,
    )
  }

  /** Osnovne informacije: marka, model, kubikaža, godište, gorivo, boja, mjenjač. */
  const basicInfo: { label: string; value: string }[] = [
    { label: t('owner.listing.carMake'), value: d.carMake.trim() || '—' },
    { label: t('owner.listing.carModel'), value: d.carModel.trim() || '—' },
    { label: t('owner.listing.carEngineCc'), value: d.carEngineCc.trim() ? `${d.carEngineCc} cm³` : '—' },
    { label: t('owner.listing.carYear'), value: d.carYear.trim() || '—' },
    { label: t('owner.listing.carFuel'), value: carEnumLabel(t, 'owner.listing.carFuelOpt', d.carFuel) },
    { label: t('owner.listing.carColor'), value: d.carColor.trim() || '—' },
    {
      label: t('owner.listing.carTransmission'),
      value: carEnumLabel(t, 'owner.listing.carGear', d.carTransmission),
    },
  ]

  const ownerAvCar = listingOwnerAvatarUrl(publicListingId)
  const draftContactCtx: DraftContactCtx = {
    ownerUserId: resolveOwnerUserIdForDraftDetail(publicListingId),
  }
  const linked = new Set(d.linkedContactIds)
  const publicContacts = d.contacts
    .filter((c) => linked.has(c.id))
    .map((c) => draftContactToOwner(c, d.contactVis, draftContactCtx, c.type === 'owner' ? ownerAvCar : null))

  const fallbackName = pickDraftLangString(d.titles, uiLang)
  const safeContacts =
    publicContacts.length > 0
      ? publicContacts
      : [
          {
            displayName: fallbackName,
            email: '',
            phones: [],
            telegram: '',
          },
        ]

  const gallery = d.images.length > 0 ? d.images : [PLACEHOLDER_IMG]

  const mapLat = d.lat ?? 42.4247
  const mapLng = d.lng ?? 18.7712
  const countryPart =
    d.countryId != null ? i18n.t(`search.country_${d.countryId}`) : ''
  const mapLabel =
    d.city.trim() && countryPart
      ? `${d.city.trim()}, ${countryPart}`
      : d.city.trim() || countryPart || '—'

  const extraLines = carExtrasDisplayLines(d.carExtras ?? defaultCarListingExtras(), t)
  const characteristicGroups =
    extraLines.length > 0
      ? [{ title: t('owner.listing.carExtrasTitle'), items: extraLines }]
      : []

  const lid = publicListingId ?? ''
  return {
    rating: 0,
    listingNumber: listingPublicNumberFromId(lid),
    viewCount: 0,
    updatedAt: new Date().toLocaleDateString('en-GB'),
    gallery,
    basicInfo,
    description: desc,
    characteristics: extraLines,
    characteristicGroups,
    pricesAndPayment: pricesLines.length ? pricesLines.join('\n') : '—',
    pricePanel,
    publicContacts: applyOmitContactChannels(safeContacts, opts?.omitContactChannels),
    contactVisibility: d.contactVis,
    mapLat,
    mapLng,
    mapLabel,
    descriptionIsPlain: true,
    characteristicsArePlain: true,
    pricesArePlain: true,
  }
}

export function buildAccommodationDraftDetail(
  d: AccommodationListingDraft,
  t: TFunction,
  uiLang: string,
  publicListingId?: string,
  opts?: BuildAccommodationDraftDetailOptions,
): ListingDetailExtra {
  if (draftFormCategory(d) === 'motorcycle') {
    return buildMotorcycleDraftDetail(d, t, uiLang, publicListingId, opts)
  }
  if (draftFormCategory(d) === 'car') {
    return buildCarDraftDetail(d, t, uiLang, publicListingId, opts)
  }
  const desc = pickDraftLangString(d.descriptions, uiLang)
  const heatingSet = new Set(d.featHeating)
  const furnSet = new Set(d.featFurniture)
  const equipSet = new Set(d.featEquipment)
  const rulesSet = new Set(d.featRules)

  const characteristicGroups = [
    {
      title: t('owner.listing.featHeating'),
      items: HEATING_OPTS.filter((o) => heatingSet.has(o.id)).map((o) => t(`owner.listing.featHeat.${o.id}`)),
    },
    {
      title: t('owner.listing.featFurniture'),
      items: FURNITURE_OPTS.filter((o) => furnSet.has(o.id)).map((o) => t(`owner.listing.featFurn.${o.id}`)),
    },
    {
      title: t('owner.listing.featEquipment'),
      items: EQUIPMENT_OPTS.filter((o) => equipSet.has(o.id)).map((o) => t(`owner.listing.featEquip.${o.id}`)),
    },
    {
      title: t('owner.listing.featRules'),
      items: RULES_OPTS.filter((o) => rulesSet.has(o.id)).map((o) => t(`owner.listing.featRule.${o.id}`)),
    },
  ].filter((g) => g.items.length > 0)

  const characteristics: string[] = characteristicGroups.flatMap((g) => g.items)

  const payBits: string[] = []
  if (d.payCashCard) payBits.push(t('owner.listing.payCashCard'))
  if (d.payCash) payBits.push(t('owner.listing.payCash'))
  if (d.payCard) payBits.push(t('owner.listing.payCard'))
  if (d.payBank) payBits.push(t('owner.listing.payBank'))

  const seasonal: { label: string; value: string }[] = []
  if (d.pricePre.trim()) seasonal.push({ label: t('owner.listing.pricePre'), value: euroLabel(d.pricePre) })
  if (d.priceSeason.trim()) seasonal.push({ label: t('owner.listing.priceIn'), value: euroLabel(d.priceSeason) })
  if (d.pricePost.trim()) seasonal.push({ label: t('owner.listing.pricePost'), value: euroLabel(d.pricePost) })
  if (d.priceOff.trim()) seasonal.push({ label: t('owner.listing.priceOff'), value: euroLabel(d.priceOff) })

  const paymentSummary = payBits.join(', ')
  const hasMainPrice = Boolean(d.priceEur.trim())
  let pricePanel: DetailPricePanel | undefined
  if (paymentSummary || hasMainPrice || seasonal.length > 0 || d.availableFrom.trim()) {
    pricePanel = {
      paymentSummary,
      mainPriceDisplay: hasMainPrice ? euroLabel(d.priceEur) : '',
      mainPriceSuffix: t('detail.prices.perNight'),
      seasonal,
      availableFrom: d.availableFrom.trim()
        ? formatDateDayMonthYear(d.availableFrom.trim())
        : undefined,
    }
  }

  const pricesLines: string[] = []
  if (d.priceEur.trim()) {
    pricesLines.push(`${t('owner.listing.priceEur')}: €${d.priceEur.trim()}`)
  }
  if (d.pricePre.trim() || d.priceSeason.trim() || d.pricePost.trim() || d.priceOff.trim()) {
    if (d.pricePre.trim()) pricesLines.push(`${t('owner.listing.pricePre')}: ${d.pricePre.trim()}`)
    if (d.priceSeason.trim()) pricesLines.push(`${t('owner.listing.priceIn')}: ${d.priceSeason.trim()}`)
    if (d.pricePost.trim()) pricesLines.push(`${t('owner.listing.pricePost')}: ${d.pricePost.trim()}`)
    if (d.priceOff.trim()) pricesLines.push(`${t('owner.listing.priceOff')}: ${d.priceOff.trim()}`)
  }
  if (payBits.length) {
    pricesLines.push(`${t('owner.listing.payment')}: ${payBits.join(', ')}`)
  }
  if (d.availableFrom.trim()) {
    pricesLines.push(
      `${t('owner.listing.availableFrom')}: ${formatDateDayMonthYear(d.availableFrom.trim())}`,
    )
  }

  /** Smještaj: vrsta, struktura, površina, grad, način plaćanja. */
  const basicInfo: { label: string; value: string }[] = [
    { label: t('owner.listing.propertyType'), value: ptLabel(t, d.propertyType) },
    { label: t('owner.listing.structure'), value: strLabel(t, d.structure) },
    { label: t('owner.listing.area'), value: d.areaM2.trim() ? `${d.areaM2} m²` : '—' },
    { label: t('detail.basic.city'), value: d.city.trim() || '—' },
    {
      label: t('owner.listing.payment'),
      value: payBits.length ? payBits.join(', ') : '—',
    },
  ]

  const ownerAvAcc = listingOwnerAvatarUrl(publicListingId)
  const draftContactCtx: DraftContactCtx = {
    ownerUserId: resolveOwnerUserIdForDraftDetail(publicListingId),
  }
  const linked = new Set(d.linkedContactIds)
  const publicContacts = d.contacts
    .filter((c) => linked.has(c.id))
    .map((c) => draftContactToOwner(c, d.contactVis, draftContactCtx, c.type === 'owner' ? ownerAvAcc : null))

  const fallbackName = pickDraftLangString(d.titles, uiLang)
  const safeContacts =
    publicContacts.length > 0
      ? publicContacts
      : [
          {
            displayName: fallbackName,
            email: '',
            phones: [],
            telegram: '',
          },
        ]

  const gallery = d.images.length > 0 ? d.images : [PLACEHOLDER_IMG]

  const mapLat = d.lat ?? 42.4247
  const mapLng = d.lng ?? 18.7712
  const countryPart =
    d.countryId != null ? i18n.t(`search.country_${d.countryId}`) : ''
  const mapLabel =
    d.city.trim() && countryPart
      ? `${d.city.trim()}, ${countryPart}`
      : d.city.trim() || countryPart || '—'

  const lid = publicListingId ?? ''
  return {
    rating: 0,
    listingNumber: listingPublicNumberFromId(lid),
    viewCount: 0,
    updatedAt: new Date().toLocaleDateString('en-GB'),
    gallery,
    basicInfo,
    description: desc,
    characteristics,
    characteristicGroups,
    pricesAndPayment: pricesLines.length ? pricesLines.join('\n') : '—',
    pricePanel,
    publicContacts: applyOmitContactChannels(safeContacts, opts?.omitContactChannels),
    contactVisibility: d.contactVis,
    mapLat,
    mapLng,
    mapLabel,
    descriptionIsPlain: true,
    characteristicsArePlain: true,
    pricesArePlain: true,
  }
}
