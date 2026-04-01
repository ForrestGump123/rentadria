import { SEARCH_COUNTRY_IDS, type SearchCountryId } from './countryIds'

function parseLines(raw: string): string[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))
  const uniq = [...new Set(lines)]
  return uniq.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
}

export async function loadCitiesForCountry(id: SearchCountryId): Promise<string[]> {
  let mod: { default: string }
  switch (id) {
    case 'al':
      mod = await import('../../../albanija_samo_gradovi_2026.txt?raw')
      break
    case 'ba':
      mod = await import('../../../bosna_i_hercegovina_samo_gradovi_2026.txt?raw')
      break
    case 'me':
      mod = await import('../../../crna_gora_samo_gradovi_2026.txt?raw')
      break
    case 'hr':
      mod = await import('../../../hrvatska_samo_gradovi_2026.txt?raw')
      break
    case 'it':
      mod = await import('../../../italija_samo_gradovi_2026.txt?raw')
      break
    case 'rs':
      mod = await import('../../../srbija_samo_gradovi_2026.txt?raw')
      break
    case 'es':
      mod = await import('../../../spanija_samo_gradovi_2026.txt?raw')
      break
  }
  return parseLines(mod.default)
}

/** Svi gradovi (za autocomplete kad je „Sve države“). */
export async function loadAllCitiesMerged(): Promise<string[]> {
  const lists = await Promise.all(SEARCH_COUNTRY_IDS.map((id) => loadCitiesForCountry(id)))
  const uniq = new Set<string>()
  for (const list of lists) {
    for (const c of list) uniq.add(c)
  }
  return [...uniq].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
}
