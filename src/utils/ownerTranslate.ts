/**
 * Prevod naslova/opisa u pregledaču: MyMemory → Google (gtx) → LibreTranslate javni.
 * LibreTranslate često ne radi (kvota, 403); Google translate_a/single ima CORS * i u praksi je najstabilniji.
 */

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
  bs: 'bs',
  sr: 'sr',
}

const LIBRE_MAP: Record<string, string> = {
  en: 'en',
  sq: 'sq',
  it: 'it',
  es: 'es',
  cnr: 'hr',
  hr: 'hr',
  bs: 'bs',
  sr: 'sr',
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

  for (const lang of targetLangs) {
    if (lang === sourceLang) continue
    await new Promise((r) => setTimeout(r, 120))
    try {
      if (ti) {
        const out = await translateText(ti, sourceLang, lang)
        if (out) titles[lang] = out
      }
    } catch {
      /* keep empty */
    }
    await new Promise((r) => setTimeout(r, 120))
    try {
      if (de) {
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
