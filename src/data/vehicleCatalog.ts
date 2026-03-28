import markeRaw from '../../marke_automobila_samo_marke_2026.txt?raw'
import modeliRaw from '../../modeli_marki_automobila_1970_2026.txt?raw'

function normalizeMake(s: string): string {
  return s.trim()
}

function parseMakes(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((l) => normalizeMake(l))
    .filter(Boolean)
}

/** Paragraphs separated by blank lines: first line = make, following = models */
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

/** Sorted vehicle makes for dropdown/autocomplete */
export const VEHICLE_MAKES: string[] = [...new Set(_MAKES_PARSED)].sort((a, b) =>
  a.localeCompare(b, undefined, { sensitivity: 'base' }),
)

export function vehicleModelsForMake(make: string): string[] {
  const m = normalizeMake(make)
  return _MODELS_MAP.get(m) ?? []
}
