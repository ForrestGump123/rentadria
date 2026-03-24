import type { SearchCountryId } from './countryIds'

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
