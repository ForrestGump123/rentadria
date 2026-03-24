import type { SubscriptionPlan } from '../types/plan'

export type PricingPlanDef = {
  id: SubscriptionPlan
  name: string
  tagline: string
  price: string
  features: string[]
  popular?: boolean
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

export function getPricingPlans(language: string): PricingPlanDef[] {
  return language === 'cnr' ? PRICING_PLANS_CNR : PRICING_PLANS_EN
}
