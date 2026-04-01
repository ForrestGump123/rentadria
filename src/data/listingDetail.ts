import type { Listing } from '../types'
import type { ListingDetailExtra } from '../types/listingDetail'

/** Placeholder gallery extras (no external hotlinking to Unsplash — avoids NS_BINDING_ABORTED / ORB in some browsers). */
const EXTRA_IMAGES = [
  'https://placehold.co/1200x780/0a101e/26c6da/png?text=RentAdria',
  'https://placehold.co/1200x780/0f1729/38bdf8/png?text=RentAdria',
  'https://placehold.co/1200x780/0c1220/22d3ee/png?text=RentAdria',
  'https://placehold.co/1200x780/111827/67e8f9/png?text=RentAdria',
] as const

function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % 1_000_000
  return h
}

/** Stable public ad number (same formula as demo listings) — use for owner drafts too. */
export function listingPublicNumberFromId(listingId: string): string {
  const h = hashId(listingId)
  return String(800 + (h % 200))
}

export function buildListingDetail(listing: Listing): ListingDetailExtra {
  const h = hashId(listing.id)
  const baseLat = 42.42 + (h % 100) / 5000
  const baseLng = 18.77 + (h % 100) / 5000

  const gallery = [
    listing.image,
    EXTRA_IMAGES[h % EXTRA_IMAGES.length],
    EXTRA_IMAGES[(h + 1) % EXTRA_IMAGES.length],
    EXTRA_IMAGES[(h + 2) % EXTRA_IMAGES.length],
  ]

  const isAcc = listing.category === 'accommodation'
  const isVehicle = listing.category === 'car' || listing.category === 'motorcycle'

  const phones: { display: string; e164: string }[] = [
    { display: '+382 69 123 456', e164: '+38269123456' },
  ]
  if (h % 5 === 0) {
    phones.push({ display: '+382 68 999 001', e164: '+38268999001' })
  }

  const ownerContact = {
    displayName: 'Milan Petrović',
    email: 'owner.example@rentadria.com',
    phones,
    telegram: 'milan_rent',
  }

  return {
    rating: Math.round((4.5 + (h % 6) / 10) * 10) / 10,
    listingNumber: listingPublicNumberFromId(listing.id),
    viewCount: 700 + (h % 4200),
    updatedAt: new Date(listing.createdAt).toLocaleDateString('en-GB'),
    gallery,
    basicInfo: isAcc
      ? [
          { label: 'detail.basic.propertyType', value: 'detail.basic.propertyTypeVal' },
          { label: 'detail.basic.structure', value: 'detail.basic.structureVal' },
          { label: 'detail.basic.area', value: 'detail.basic.areaVal' },
          { label: 'detail.basic.city', value: listing.location.split(',')[0]?.trim() ?? '—' },
          { label: 'detail.basic.payment', value: 'detail.basic.paymentVal' },
        ]
      : isVehicle
        ? [
            {
              label: 'detail.basic.make',
              value:
                listing.category === 'motorcycle'
                  ? 'detail.basic.demoMotoMake'
                  : 'detail.basic.demoCarMake',
            },
            { label: 'detail.basic.model', value: listing.title },
            {
              label: 'detail.basic.displacement',
              value:
                listing.category === 'motorcycle'
                  ? 'detail.basic.demoMotoDisplacement'
                  : 'detail.basic.demoCarDisplacement',
            },
            {
              label: 'detail.basic.year',
              value:
                listing.category === 'motorcycle'
                  ? 'detail.basic.demoMotoYear'
                  : 'detail.basic.demoCarYear',
            },
            {
              label: 'detail.basic.fuel',
              value:
                listing.category === 'motorcycle'
                  ? 'detail.basic.demoMotoFuel'
                  : 'detail.basic.demoCarFuel',
            },
            {
              label: 'detail.basic.color',
              value:
                listing.category === 'motorcycle'
                  ? 'detail.basic.demoMotoColor'
                  : 'detail.basic.demoCarColor',
            },
            {
              label: 'detail.basic.transmission',
              value:
                listing.category === 'motorcycle'
                  ? 'detail.basic.demoMotoTransmission'
                  : 'detail.basic.demoCarTransmission',
            },
          ]
        : [
            { label: 'detail.basic.model', value: listing.title },
            { label: 'detail.basic.location', value: listing.location },
            { label: 'detail.basic.payment', value: 'detail.basic.paymentVal' },
          ],
    description: 'detail.description.text',
    characteristics: ['detail.char.line1', 'detail.char.line2', 'detail.char.line3', 'detail.char.line4'],
    pricesAndPayment: 'detail.prices.text',
    publicContacts: [ownerContact],
    mapLat: baseLat,
    mapLng: baseLng,
    mapLabel: listing.location,
  }
}
