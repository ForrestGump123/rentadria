import type { CurrencyCode } from '../types/currency'

/** ECB-style fixed peg (approx.) EUR → BAM */
export const EUR_TO_BAM = 1.95583

export function parseEurPriceLabel(priceLabel: string): { amount: number; period: string } | null {
  const m = priceLabel.match(/€\s*([\d.,]+)\s*\/\s*(\w+)/i)
  if (!m) return null
  const amount = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'))
  if (Number.isNaN(amount)) return null
  return { amount, period: m[2].toLowerCase() }
}

function formatAmount(amount: number, currency: CurrencyCode): string {
  if (currency === 'ALL') {
    return `${Math.round(amount).toLocaleString('en-US', { maximumFractionDigits: 0 })} Lek`
  }
  if (currency === 'BAM') {
    const n = Math.round(amount * 100) / 100
    return `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM`
  }
  const n = Math.round(amount * 100) / 100
  const s = n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)
  return `€${s}`
}

/** Convert stored EUR-based label to the selected currency using live ALL rate when needed. */
export function formatListingPrice(
  priceLabel: string,
  currency: CurrencyCode,
  eurToAll: number | null,
): string {
  const parsed = parseEurPriceLabel(priceLabel)
  if (!parsed) return priceLabel
  let val = parsed.amount
  if (currency === 'BAM') val *= EUR_TO_BAM
  else if (currency === 'ALL') val *= eurToAll ?? 100
  return `${formatAmount(val, currency)}/${parsed.period}`
}
