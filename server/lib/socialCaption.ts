import type { SocialCardCategory } from './renderSocialTemplate.js'

/** First-line caption icon (matches client Instagram template). */
export function categoryCaptionEmoji(cat: SocialCardCategory): string {
  if (cat === 'car') return '🚗'
  if (cat === 'motorcycle') return '🏍️'
  return '🏠'
}

/**
 * Universal caption for Instagram + Facebook (text below the rendered image).
 * Title, phone and URL come from `social_queue` — same source as the template render.
 * Copy aligned with `instagram.*` in `src/locales/en.json`.
 */
const HASHTAG_BLOCK =
  '#RentAdria #Travel #Montenegro #BalkanTravel #Albania #Bosnia #Herzegovina #Croatia #Serbia #Italy #Spain #Accommodation #RentACar #MotoRent #NoCommission'

export function buildRentadriaSocialCaption(params: {
  category: SocialCardCategory
  /** e.g. "Penthouse #14" — site title + short display id */
  titleLine: string
  /** Full listing page URL */
  listingUrl: string
  phoneLine: string
}): string {
  const emoji = categoryCaptionEmoji(params.category)
  let caption = [
    `🌊 ${params.titleLine} ${emoji}`,
    '',
    'Looking for the perfect stay or transport on the Adriatic and Mediterranean? Connect directly with the owner and save on commissions.',
    '',
    `🔗 More details at: ${params.listingUrl}`,
    `📞 Contact the owner directly: ${params.phoneLine}`,
    '',
    HASHTAG_BLOCK,
  ].join('\n')
  if (caption.length > 2100) caption = caption.slice(0, 2100)
  return caption
}
