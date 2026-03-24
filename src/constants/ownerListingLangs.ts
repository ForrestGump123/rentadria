export const LISTING_LANG_IDS = ['en', 'sq', 'it', 'es', 'cnr', 'hr', 'bs', 'sr'] as const
export type ListingLangId = (typeof LISTING_LANG_IDS)[number]

export const LISTING_LANG_LABELS: Record<ListingLangId, string> = {
  en: 'English',
  sq: 'Albanski',
  it: 'Italiano',
  es: 'Español',
  cnr: 'MNE',
  hr: 'HR',
  bs: 'BiH',
  sr: 'SR',
}
