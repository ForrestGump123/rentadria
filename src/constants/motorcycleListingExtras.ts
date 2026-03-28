export type MotoExtraMoney = { on: boolean; price: string }

export type MotorcycleListingExtras = {
  driverHelmet: MotoExtraMoney
  passengerHelmet: MotoExtraMoney
  padlock: MotoExtraMoney
  topCase: MotoExtraMoney
  navigation: MotoExtraMoney
  phoneHolder: MotoExtraMoney
  hotelDelivery: MotoExtraMoney
  airportDelivery: MotoExtraMoney
  officeTransfer: MotoExtraMoney
  dropOff: MotoExtraMoney
  otherCityDelivery: MotoExtraMoney
  minAgeExperience: { on: boolean; text: string }
  /** „po dogovoru“ pored minimalne starosti / iskustva */
  minAgeByAgreement: boolean
}

export function defaultMotorcycleListingExtras(): MotorcycleListingExtras {
  const z = (): MotoExtraMoney => ({ on: false, price: '0' })
  return {
    driverHelmet: z(),
    passengerHelmet: z(),
    padlock: z(),
    topCase: z(),
    navigation: z(),
    phoneHolder: z(),
    hotelDelivery: z(),
    airportDelivery: z(),
    officeTransfer: z(),
    dropOff: z(),
    otherCityDelivery: z(),
    minAgeExperience: { on: false, text: '' },
    minAgeByAgreement: false,
  }
}

function parseMoney(raw: unknown): MotoExtraMoney {
  if (!raw || typeof raw !== 'object') return { on: false, price: '0' }
  const o = raw as Record<string, unknown>
  return {
    on: !!o.on,
    price: typeof o.price === 'string' ? o.price : '0',
  }
}

export function normalizeMotorcycleListingExtras(raw: unknown): MotorcycleListingExtras {
  const d = defaultMotorcycleListingExtras()
  if (!raw || typeof raw !== 'object') return d
  const p = raw as Record<string, unknown>
  const ma = p.minAgeExperience
  return {
    driverHelmet: parseMoney(p.driverHelmet),
    passengerHelmet: parseMoney(p.passengerHelmet),
    padlock: parseMoney(p.padlock),
    topCase: parseMoney(p.topCase),
    navigation: parseMoney(p.navigation),
    phoneHolder: parseMoney(p.phoneHolder),
    hotelDelivery: parseMoney(p.hotelDelivery),
    airportDelivery: parseMoney(p.airportDelivery),
    officeTransfer: parseMoney(p.officeTransfer),
    dropOff: parseMoney(p.dropOff),
    otherCityDelivery: parseMoney(p.otherCityDelivery),
    minAgeExperience:
      ma && typeof ma === 'object'
        ? {
            on: !!(ma as { on?: boolean }).on,
            text: typeof (ma as { text?: string }).text === 'string' ? (ma as { text: string }).text : '',
          }
        : d.minAgeExperience,
    minAgeByAgreement:
      !!(p as { minAgeByAgreement?: boolean }).minAgeByAgreement ||
      !!(p as { otherCityByAgreement?: boolean }).otherCityByAgreement,
  }
}
