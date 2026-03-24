/**
 * Besplatni MyMemory API (ograničen). Za produkciju zamijeniti backend prevodom.
 */
const PAIR = (from: string, to: string) => `${from}|${to}`

const MYMEMORY_MAP: Record<string, string> = {
  en: 'en',
  sq: 'sq',
  it: 'it',
  es: 'es',
  cnr: 'hr',
  hr: 'hr',
  bs: 'bs',
  sr: 'sr',
}

function myMemoryCode(id: string): string {
  return MYMEMORY_MAP[id] ?? 'en'
}

export async function translateText(text: string, fromLang: string, toLang: string): Promise<string> {
  const t = text.trim()
  if (!t) return ''
  const from = myMemoryCode(fromLang)
  const to = myMemoryCode(toLang)
  if (from === to) return t
  const q = encodeURIComponent(t.slice(0, 450))
  const url = `https://api.mymemory.translated.net/get?q=${q}&langpair=${PAIR(from, to)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('translate')
  const data = (await res.json()) as { responseData?: { translatedText?: string } }
  const out = data.responseData?.translatedText?.trim()
  if (!out) throw new Error('empty')
  return out
}

export async function translateListingFields(
  sourceLang: string,
  title: string,
  description: string,
  targetLangs: readonly string[],
): Promise<{ titles: Record<string, string>; descriptions: Record<string, string> }> {
  const titles: Record<string, string> = {}
  const descriptions: Record<string, string> = {}
  for (const lang of targetLangs) {
    if (lang === sourceLang) continue
    await new Promise((r) => setTimeout(r, 120))
    titles[lang] = await translateText(title, sourceLang, lang).catch(() => '')
    await new Promise((r) => setTimeout(r, 120))
    descriptions[lang] = await translateText(description, sourceLang, lang).catch(() => '')
  }
  return { titles, descriptions }
}

