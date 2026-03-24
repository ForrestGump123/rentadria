/** Search countries: alphabetical by local name (Albanija … Španija). */
export const SEARCH_COUNTRY_IDS = ['al', 'ba', 'me', 'hr', 'it', 'rs', 'es'] as const

export type SearchCountryId = (typeof SEARCH_COUNTRY_IDS)[number]

/** ISO 3166-1 alpha-2 used in mock listing locations */
export const SEARCH_COUNTRY_ISO: Record<SearchCountryId, string> = {
  al: 'AL',
  ba: 'BA',
  me: 'ME',
  hr: 'HR',
  it: 'IT',
  rs: 'RS',
  es: 'ES',
}
