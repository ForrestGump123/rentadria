import type { SocialCardCategory } from './renderSocialTemplate.js'

/** Ikona u prvom redu captiona (usklađeno s UI šablonom). */
export function categoryCaptionEmoji(cat: SocialCardCategory): string {
  if (cat === 'car') return '🚗'
  if (cat === 'motorcycle') return '🏍️'
  return '🏠'
}

/**
 * Univerzalni caption za Instagram + Facebook (tekst ispod generisane slike).
 * Naslov i kontakt dolaze iz payloada reda; link koristi javni ID oglasa.
 */
const HASHTAG_BLOCK =
  '#RentAdria #Travel #Montenegro #Albania #Serbia #Croatia #BosniaHerzegovina #Spain #Italy #BalkanTravel #Accommodation #RentACar #MotoRent #NoCommission'

export function buildRentadriaSocialCaption(params: {
  category: SocialCardCategory
  /** npr. "Penthouse #14" — naslov sa sajta + kratki prikaz ID-a */
  titleLine: string
  /** Puna URL stranice oglasa */
  listingUrl: string
  phoneLine: string
}): string {
  const emoji = categoryCaptionEmoji(params.category)
  let caption = [
    `🌊 ${params.titleLine} ${emoji}`,
    '',
    'Tražite savršen boravak ili prevoz na Jadranu i Mediteranu? Povežite se direktno sa vlasnikom i uštedite na provizijama.',
    '',
    `🔗 Detaljnije na: ${params.listingUrl}`,
    `📞 Kontaktirajte vlasnika direktno: ${params.phoneLine}`,
    '',
    HASHTAG_BLOCK,
  ].join('\n')
  if (caption.length > 2100) caption = caption.slice(0, 2100)
  return caption
}
