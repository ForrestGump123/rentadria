import markeRaw from '../../marke_motorcikala_samo_marke_2026.txt?raw'
import modeliRaw from '../../modeli_marki_motorcikala_2026_ponovo.txt?raw'

function normalizeMake(s: string): string {
  return s.trim()
}

function parseMakes(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((l) => normalizeMake(l))
    .filter(Boolean)
}

/** Blokovi odvojeni praznim redovima: prvi red = marka, ostalo = modeli */
function parseModelsByMake(raw: string): Map<string, string[]> {
  const map = new Map<string, string[]>()
  const blocks = raw.split(/\r?\n\s*\r?\n/)
  for (const block of blocks) {
    const lines = block
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) continue
    const make = lines[0]!
    const models = lines.slice(1)
    if (!map.has(make)) map.set(make, models)
  }
  return map
}

const _MAKES_PARSED = parseMakes(markeRaw)
const _MODELS_MAP = parseModelsByMake(modeliRaw)

export const MOTORCYCLE_MAKES: string[] = [...new Set(_MAKES_PARSED)].sort((a, b) =>
  a.localeCompare(b, undefined, { sensitivity: 'base' }),
)

export function motorcycleModelsForMake(make: string): string[] {
  const m = normalizeMake(make)
  return _MODELS_MAP.get(m) ?? []
}
