export interface OwnerContact {
  displayName: string
  email: string
  /** One or more numbers; messenger icons use the matching digits per row */
  phones: { display: string; e164: string }[]
  /** Telegram @username (same for all numbers) */
  telegram: string
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
  pricesAndPayment: string
  owner: OwnerContact
  mapLat: number
  mapLng: number
  mapLabel: string
}
