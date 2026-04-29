/**
 * Prevod naslova/opisa: prvo naš server-side Gemini endpoint, zatim browser fallback
 * MyMemory → Google (gtx) → LibreTranslate javni.
 */

type ListingTranslateResult = {
  titles: Record<string, string>
  descriptions: Record<string, string>
}

const AI_CACHE_KEY = 'rentadria_ai_listing_translate_cache_v1'
const AI_CACHE_MAX = 80

const MYMEMORY_MAP: Record<string, string> = {
  en: 'en',
  sq: 'sq',
  it: 'it',
  es: 'es',
  cnr: 'hr',
  hr: 'hr',
  bs: 'hr',
  sr: 'hr',
}

/**
 * Jezički kod za vanjske servise (hr kao najbliži za CG/MNE u Google/Libre porodici).
 */
const SERVICE_LANG: Record<string, string> = {
  en: 'en',
  sq: 'sq',
  it: 'it',
  es: 'es',
  cnr: 'hr',
  hr: 'hr',
  bs: 'hr',
  sr: 'hr',
}

const LIBRE_MAP: Record<string, string> = {
  en: 'en',
  sq: 'sq',
  it: 'it',
  es: 'es',
  cnr: 'hr',
  hr: 'hr',
  bs: 'hr',
  sr: 'hr',
}

function serviceLang(id: string): string {
  return SERVICE_LANG[id.split('-')[0] ?? 'en'] ?? 'en'
}

function myMemoryCode(id: string): string {
  return MYMEMORY_MAP[id] ?? 'en'
}

function libreCode(id: string): string {
  return LIBRE_MAP[id.split('-')[0] ?? 'en'] ?? 'en'
}

function mmLangpair(from: string, to: string): string {
  return `${from}|${to}`
}

function simpleHash(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

function loadAiCache(): Record<string, ListingTranslateResult> {
  try {
    const raw = localStorage.getItem(AI_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, ListingTranslateResult>)
      : {}
  } catch {
    return {}
  }
}

function saveAiCache(cache: Record<string, ListingTranslateResult>) {
  try {
    const entries = Object.entries(cache)
    const trimmed = Object.fromEntries(entries.slice(Math.max(0, entries.length - AI_CACHE_MAX)))
    localStorage.setItem(AI_CACHE_KEY, JSON.stringify(trimmed))
  } catch {
    /* ignore */
  }
}

function aiCacheKey(sourceLang: string, title: string, description: string, targetLangs: readonly string[]): string {
  return simpleHash(JSON.stringify({ sourceLang, title, description, targetLangs: [...targetLangs].sort() }))
}

function cleanTranslationRecord(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string' && v.trim()) out[k] = v.trim()
  }
  return out
}

async function aiTranslateListingFields(
  sourceLang: string,
  title: string,
  description: string,
  targetLangs: readonly string[],
): Promise<ListingTranslateResult | null> {
  const targets = targetLangs.filter((l) => l !== sourceLang)
  if (targets.length === 0) return { titles: {}, descriptions: {} }
  const key = aiCacheKey(sourceLang, title, description, targets)
  const cache = loadAiCache()
  if (cache[key]) return cache[key]

  try {
    const r = await fetch('/api/ai-listing-translate', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceLang,
        title,
        description,
        targetLangs: targets,
      }),
    })
    if (!r.ok) return null
    const j = (await r.json()) as { ok?: boolean; titles?: unknown; descriptions?: unknown }
    if (!j.ok) return null
    const result = {
      titles: cleanTranslationRecord(j.titles),
      descriptions: cleanTranslationRecord(j.descriptions),
    }
    if (Object.keys(result.titles).length === 0 && Object.keys(result.descriptions).length === 0) return null
    cache[key] = result
    saveAiCache(cache)
    return result
  } catch {
    return null
  }
}

async function myMemoryTranslate(text: string, fromLang: string, toLang: string): Promise<string | null> {
  const from = myMemoryCode(fromLang)
  const to = myMemoryCode(toLang)
  if (from === to) return text.trim()
  const q = encodeURIComponent(text.slice(0, 480))
  const url = `https://api.mymemory.translated.net/get?q=${q}&langpair=${mmLangpair(from, to)}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = (await res.json()) as {
    responseData?: { translatedText?: string }
    responseStatus?: number
  }
  const out = data.responseData?.translatedText?.trim()
  if (!out) return null
  if (out.includes('MYMEMORY WARNING')) return null
  if (out === text.trim() && from !== to) return null
  return out
}

function parseGtxBody(data: unknown): string | null {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return null
  let out = ''
  for (const block of data[0] as unknown[]) {
    if (Array.isArray(block) && typeof block[0] === 'string') out += block[0]
  }
  const t = out.trim()
  return t || null
}

/** Google client=gtx — radi iz pregledača (Access-Control-Allow-Origin: *). */
async function googleGtxTranslate(text: string, fromLang: string, toLang: string): Promise<string | null> {
  const sl = serviceLang(fromLang)
  const tl = serviceLang(toLang)
  if (sl === tl) return text.trim()
  const q = text.slice(0, 4800)
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&ie=UTF-8&oe=UTF-8` +
    `&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(q)}`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data: unknown = await res.json()
    return parseGtxBody(data)
  } catch {
    return null
  }
}

const LIBRE_ENDPOINTS: string[] = import.meta.env.DEV
  ? ['/api/lt/translate', '/api/lt2/translate']
  : ['https://libretranslate.de/translate', 'https://translate.argosopentech.com/translate']

async function libreTranslate(text: string, fromLang: string, toLang: string): Promise<string | null> {
  const source = libreCode(fromLang)
  const target = libreCode(toLang)
  if (source === target) return text.trim()
  const body = JSON.stringify({
    q: text.slice(0, 2800),
    source,
    target,
    format: 'text',
  })
  for (const ep of LIBRE_ENDPOINTS) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (!res.ok) continue
      const data = (await res.json()) as { translatedText?: string }
      const out = data.translatedText?.trim()
      if (out) return out
    } catch {
      continue
    }
  }
  return null
}

export async function translateText(text: string, fromLang: string, toLang: string): Promise<string> {
  const t = text.trim()
  if (!t) return ''
  if (fromLang === toLang) return t
  /** Isti servisni kod (npr. cnr i hr → hr): kopiraj izvor u ciljni tab bez API-ja. */
  if (serviceLang(fromLang) === serviceLang(toLang)) return t

  const mm = await myMemoryTranslate(t, fromLang, toLang)
  if (mm) return mm
  const gtx = await googleGtxTranslate(t, fromLang, toLang)
  if (gtx) return gtx
  const lt = await libreTranslate(t, fromLang, toLang)
  if (lt) return lt
  throw new Error('translate')
}

export async function translateListingFields(
  sourceLang: string,
  title: string,
  description: string,
  targetLangs: readonly string[],
): Promise<{ titles: Record<string, string>; descriptions: Record<string, string> }> {
  const titles: Record<string, string> = {}
  const descriptions: Record<string, string> = {}
  const ti = title.trim()
  const de = description.trim()

  const ai = await aiTranslateListingFields(sourceLang, ti, de, targetLangs)
  if (ai) {
    Object.assign(titles, ai.titles)
    Object.assign(descriptions, ai.descriptions)
  }

  for (const lang of targetLangs) {
    if (lang === sourceLang) continue
    const needsTitle = ti && !titles[lang]
    const needsDescription = de && !descriptions[lang]
    if (!needsTitle && !needsDescription) continue
    await new Promise((r) => setTimeout(r, 120))
    try {
      if (needsTitle) {
        const out = await translateText(ti, sourceLang, lang)
        if (out) titles[lang] = out
      }
    } catch {
      /* keep empty */
    }
    await new Promise((r) => setTimeout(r, 120))
    try {
      if (needsDescription) {
        const parts = de.length > 2200 ? chunkString(de, 2000) : [de]
        const outs: string[] = []
        for (const p of parts) {
          try {
            const o = await translateText(p, sourceLang, lang)
            outs.push(o)
          } catch {
            /* skip chunk */
          }
          await new Promise((r) => setTimeout(r, 100))
        }
        const merged = outs.join('\n\n').trim()
        if (merged) descriptions[lang] = merged
      }
    } catch {
      /* keep empty */
    }
  }
  return { titles, descriptions }
}

function chunkString(s: string, max: number): string[] {
  const out: string[] = []
  let i = 0
  while (i < s.length) {
    let end = Math.min(i + max, s.length)
    if (end < s.length) {
      const cut = s.lastIndexOf('\n\n', end)
      if (cut > i + max * 0.5) end = cut
    }
    out.push(s.slice(i, end).trim())
    i = end
  }
  return out.filter(Boolean)
}
