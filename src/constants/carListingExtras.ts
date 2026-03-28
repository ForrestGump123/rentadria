export type CarExtraMoney = { on: boolean; price: string }

export type CarListingExtras = {
  dailyKmLimit: { on: boolean; km: string }
  extraKm: CarExtraMoney
  airportTax: CarExtraMoney
  theftCoverage: CarExtraMoney
  vat21: CarExtraMoney
  babySeat: CarExtraMoney
  boosterSeat: CarExtraMoney
  scdw: CarExtraMoney
  airConditioning: { on: boolean }
  damageCoverage: CarExtraMoney
  winterTires: CarExtraMoney
  extraDriver: CarExtraMoney
  childSeat: CarExtraMoney
  crossBorder: CarExtraMoney
  gps: CarExtraMoney
}

export function defaultCarListingExtras(): CarListingExtras {
  const z = (): CarExtraMoney => ({ on: false, price: '0' })
  return {
    dailyKmLimit: { on: false, km: '0' },
    extraKm: z(),
    airportTax: z(),
    theftCoverage: z(),
    vat21: z(),
    babySeat: z(),
    boosterSeat: z(),
    scdw: z(),
    airConditioning: { on: false },
    damageCoverage: z(),
    winterTires: z(),
    extraDriver: z(),
    childSeat: z(),
    crossBorder: z(),
    gps: z(),
  }
}

function parseMoney(raw: unknown): CarExtraMoney {
  if (!raw || typeof raw !== 'object') return { on: false, price: '0' }
  const o = raw as Record<string, unknown>
  return {
    on: !!o.on,
    price: typeof o.price === 'string' ? o.price : '0',
  }
}

/** Merges partial JSON from localStorage into a full extras object. */
export function normalizeCarListingExtras(raw: unknown): CarListingExtras {
  const d = defaultCarListingExtras()
  if (!raw || typeof raw !== 'object') return d
  const p = raw as Record<string, unknown>

  const dm = p.dailyKmLimit
  const ac = p.airConditioning

  return {
    dailyKmLimit:
      dm && typeof dm === 'object'
        ? {
            on: !!(dm as { on?: boolean }).on,
            km:
              typeof (dm as { km?: string }).km === 'string'
                ? (dm as { km: string }).km
                : d.dailyKmLimit.km,
          }
        : d.dailyKmLimit,
    extraKm: parseMoney(p.extraKm),
    airportTax: parseMoney(p.airportTax),
    theftCoverage: parseMoney(p.theftCoverage),
    vat21: parseMoney(p.vat21),
    babySeat: parseMoney(p.babySeat),
    boosterSeat: parseMoney(p.boosterSeat),
    scdw: parseMoney(p.scdw),
    airConditioning:
      ac && typeof ac === 'object'
        ? { on: !!(ac as { on?: boolean }).on }
        : d.airConditioning,
    damageCoverage: parseMoney(p.damageCoverage),
    winterTires: parseMoney(p.winterTires),
    extraDriver: parseMoney(p.extraDriver),
    childSeat: parseMoney(p.childSeat),
    crossBorder: parseMoney(p.crossBorder),
    gps: parseMoney(p.gps),
  }
}
