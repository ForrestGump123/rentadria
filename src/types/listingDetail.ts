export interface OwnerContact {
  displayName: string
  email: string
  /** One or more numbers; messenger icons use the matching digits per row */
  phones: { display: string; e164: string }[]
  /** Telegram @username (same for all numbers) */
  telegram: string
  /** Profilna slika vlasnika (data URL), prikaz pored imena u kontaktu. */
  avatarUrl?: string
}

export interface DetailCharacteristicGroup {
  title: string
  items: string[]
}

export interface DetailPricePanel {
  paymentSummary: string
  mainPriceDisplay: string
  mainPriceSuffix: string
  seasonal: { label: string; value: string }[]
  availableFrom?: string
}

export interface ListingDetailExtra {
  rating: number
  listingNumber: string
  /** Synthetic view count for display */
  viewCount: number
  updatedAt: string
  gallery: string[]
  basicInfo: { label: string; value: string }[]
  description: string
  characteristics: string[]
  /** Grouped amenities (e.g. owner draft) — grid / chips UI */
  characteristicGroups?: DetailCharacteristicGroup[]
  pricesAndPayment: string
  /** Structured prices block (owner draft) */
  pricePanel?: DetailPricePanel
  /** Contacts shown on the public listing (in order) */
  publicContacts: OwnerContact[]
  /** Visitor visibility for email vs phone (owner-published listings) */
  contactVisibility?: 'both' | 'email' | 'phone'
  mapLat: number
  mapLng: number
  mapLabel: string
  /** When true, description is plain text (not an i18n key under detail.*) */
  descriptionIsPlain?: boolean
  characteristicsArePlain?: boolean
  pricesArePlain?: boolean
}
