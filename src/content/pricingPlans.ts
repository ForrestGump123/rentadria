import type { SubscriptionPlan } from '../types/plan'
import { isSubscriptionPlan } from '../types/plan'
import { loadPricingOverride } from '../utils/pricingOverrides'

export type PricingPlanDef = {
  id: string
  /** Za dodatne pakete: koji plan aktivira u aplikaciji (null = samo prikaz, bez aktivacije) */
  mapsToPlan?: SubscriptionPlan | null
  name: string
  tagline: string
  price: string
  features: string[]
  popular?: boolean
}

/** Koji plan pretplate odgovara kartici (npr. dodatni paket mapiran na Pro). */
export function resolvePlanForSubscription(p: PricingPlanDef): SubscriptionPlan | null {
  if (p.mapsToPlan != null && isSubscriptionPlan(p.mapsToPlan)) return p.mapsToPlan
  if (isSubscriptionPlan(p.id)) return p.id
  return null
}

export const PRICING_PLANS_CNR: PricingPlanDef[] = [
  {
    id: 'basic',
    name: 'Basic',
    tagline: 'Za pojedinačne vlasnike',
    price: '49',
    features: [
      '1 kategorija (Smještaj, Auto ili Motor)',
      'Do 2 oglasa u kategoriji',
      'Dodajte do 2 broja telefona',
      'Pristup forumu vlasnika',
      'Obavijesti za upite i mjesečni izvještaj',
      'Bez provizije na rezervacije',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Za male firme i ozbiljne izdavače',
    price: '99',
    popular: true,
    features: [
      'Sve 3 kategorije dostupne',
      'Do 5 oglasa po kategoriji',
      'Dodajte do 5 brojeva telefona',
      '15 dana slideshow + 15 dana istaknuti kvadratići',
      'Prioritetna podrška',
      'Mogućnost verifikacije oglasa (Bedž: Provjereno)',
      'Sve iz Basic paketa',
    ],
  },
  {
    id: 'agency',
    name: 'Agency',
    tagline: 'Za agencije i velike vozne parkove',
    price: '199',
    features: [
      'Sve 3 kategorije dostupne',
      'Neograničen broj oglasa',
      'Neograničen broj brojeva telefona',
      '3 mjeseca slideshow + 3 mjeseca istaknuti kvadratići',
      'Maksimalan prioritet u pretrazi (Uvijek na vrhu)',
      'Personalizirana podrška 24/7',
      'Sve iz Pro paketa',
    ],
  },
]

export const PRICING_PLANS_EN: PricingPlanDef[] = [
  {
    id: 'basic',
    name: 'Basic',
    tagline: 'For individual owners',
    price: '49',
    features: [
      '1 category (Accommodation, Car or Motorcycle)',
      'Up to 2 listings per category',
      'Add up to 2 phone numbers',
      'Access to the owners’ forum',
      'Inquiry notifications and monthly report',
      'No commission on bookings',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For small businesses and serious hosts',
    price: '99',
    popular: true,
    features: [
      'All 3 categories available',
      'Up to 5 listings per category',
      'Add up to 5 phone numbers',
      '15 days slideshow + 15 days featured tiles',
      'Priority support',
      'Listing verification available (Verified badge)',
      'Everything in Basic',
    ],
  },
  {
    id: 'agency',
    name: 'Agency',
    tagline: 'For agencies and large fleets',
    price: '199',
    features: [
      'All 3 categories available',
      'Unlimited listings',
      'Unlimited phone numbers',
      '3 months slideshow + 3 months featured tiles',
      'Maximum search priority (always on top)',
      'Personalised 24/7 support',
      'Everything in Pro',
    ],
  },
]

export const PRICING_PLANS_SQ: PricingPlanDef[] = [
  {
    id: 'basic',
    name: 'Basic',
    tagline: 'Për pronarë individualë',
    price: '49',
    features: [
      '1 kategori (Akomodim, Makina ose Motor)',
      'Deri në 2 shpallje për kategori',
      'Shtoni deri në 2 numra telefoni',
      'Qasje në forumin e pronarëve',
      'Njoftime për pyetje dhe raport mujor',
      'Pa komision për rezervime',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Për biznese të vogla dhe hostë seriozë',
    price: '99',
    popular: true,
    features: [
      'Të 3 kategoritë në dispozicion',
      'Deri në 5 shpallje për kategori',
      'Shtoni deri në 5 numra telefoni',
      '15 ditë slideshow + 15 ditë kutiza të theksuara',
      'Mbështetje me prioritet',
      'Verifikim shpalljesh i mundshëm (distinktivi E verifikuar)',
      'Gjithçka nga paketa Basic',
    ],
  },
  {
    id: 'agency',
    name: 'Agency',
    tagline: 'Për agjenci dhe flota të mëdha',
    price: '199',
    features: [
      'Të 3 kategoritë në dispozicion',
      'Shpallje të pakufizuara',
      'Numra telefoni të pakufizuar',
      '3 muaj slideshow + 3 muaj kutiza të theksuara',
      'Prioritet maksimal në kërkim (gjithmonë në krye)',
      'Mbështetje e personalizuar 24/7',
      'Gjithçka nga paketa Pro',
    ],
  },
]

export const PRICING_PLANS_IT: PricingPlanDef[] = [
  {
    id: 'basic',
    name: 'Basic',
    tagline: 'Per proprietari individuali',
    price: '49',
    features: [
      '1 categoria (Alloggio, Auto o Moto)',
      'Fino a 2 annunci per categoria',
      'Aggiungi fino a 2 numeri di telefono',
      'Accesso al forum dei proprietari',
      'Notifiche richieste e report mensile',
      'Nessuna commissione sulle prenotazioni',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Per piccole imprese e host attenti',
    price: '99',
    popular: true,
    features: [
      'Tutte e 3 le categorie disponibili',
      'Fino a 5 annunci per categoria',
      'Aggiungi fino a 5 numeri di telefono',
      '15 giorni slideshow + 15 giorni riquadri in evidenza',
      'Supporto prioritario',
      'Verifica annunci disponibile (badge Verificato)',
      'Tutto del piano Basic',
    ],
  },
  {
    id: 'agency',
    name: 'Agency',
    tagline: 'Per agenzie e grandi flotte',
    price: '199',
    features: [
      'Tutte e 3 le categorie disponibili',
      'Annunci illimitati',
      'Numeri di telefono illimitati',
      '3 mesi slideshow + 3 mesi riquadri in evidenza',
      'Priorità massima nella ricerca (sempre in cima)',
      'Supporto personalizzato 24/7',
      'Tutto del piano Pro',
    ],
  },
]

export const PRICING_PLANS_ES: PricingPlanDef[] = [
  {
    id: 'basic',
    name: 'Basic',
    tagline: 'Para propietarios individuales',
    price: '49',
    features: [
      '1 categoría (Alojamiento, Coche o Moto)',
      'Hasta 2 anuncios por categoría',
      'Añada hasta 2 números de teléfono',
      'Acceso al foro de propietarios',
      'Avisos de consultas e informe mensual',
      'Sin comisión sobre reservas',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Para pequeñas empresas y anfitriones serios',
    price: '99',
    popular: true,
    features: [
      'Las 3 categorías disponibles',
      'Hasta 5 anuncios por categoría',
      'Añada hasta 5 números de teléfono',
      '15 días slideshow + 15 días mosaicos destacados',
      'Soporte prioritario',
      'Verificación de anuncios disponible (insignia Verificado)',
      'Todo lo del plan Basic',
    ],
  },
  {
    id: 'agency',
    name: 'Agency',
    tagline: 'Para agencias y grandes flotas',
    price: '199',
    features: [
      'Las 3 categorías disponibles',
      'Anuncios ilimitados',
      'Números de teléfono ilimitados',
      '3 meses slideshow + 3 meses mosaicos destacados',
      'Prioridad máxima en búsqueda (siempre arriba)',
      'Soporte personalizado 24/7',
      'Todo lo del plan Pro',
    ],
  },
]

const BALKAN_LOCALES = new Set(['cnr', 'sr', 'hr', 'bs'])

export function resolvePricingLocale(language: string): 'cnr' | 'en' | 'sq' | 'it' | 'es' {
  const base = (language.split('-')[0] ?? 'en').toLowerCase()
  if (BALKAN_LOCALES.has(base)) return 'cnr'
  if (base === 'sq') return 'sq'
  if (base === 'it') return 'it'
  if (base === 'es') return 'es'
  return 'en'
}

export function getPricingPlans(language: string): PricingPlanDef[] {
  const loc = resolvePricingLocale(language)
  const over = loadPricingOverride(loc)
  if (over && over.length > 0) return over
  switch (loc) {
    case 'cnr':
      return PRICING_PLANS_CNR
    case 'sq':
      return PRICING_PLANS_SQ
    case 'it':
      return PRICING_PLANS_IT
    case 'es':
      return PRICING_PLANS_ES
    default:
      return PRICING_PLANS_EN
  }
}
