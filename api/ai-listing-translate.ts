import { createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ownerUserIdFromCookie } from '../server/lib/ownerSessionAuth.js'
import { parseRequestJsonRecord } from '../server/lib/parseRequestJson.js'
import { clientIp, rateLimit } from '../server/lib/rateLimitIp.js'

const VALID_LANGS = new Set(['en', 'sq', 'it', 'es', 'cnr', 'hr', 'bs', 'sr'])
const MAX_TEXT_CHARS = 6_000
const MAX_TARGETS = 8
const CACHE_MAX = 400

type TranslationResult = {
  titles: Record<string, string>
  descriptions: Record<string, string>
}

const cache = new Map<string, TranslationResult>()

function cacheKey(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}

function remember(key: string, value: TranslationResult): void {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value
    if (first) cache.delete(first)
  }
  cache.set(key, value)
}

function cleanLang(raw: unknown): string {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return VALID_LANGS.has(v) ? v : ''
}

function cleanText(raw: unknown, max: number): string {
  return (typeof raw === 'string' ? raw : '').trim().slice(0, max)
}

function parseGeminiJson(text: string): TranslationResult | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const rec = parsed as Record<string, unknown>
    const titlesRaw = rec.titles
    const descRaw = rec.descriptions
    const titles: Record<string, string> = {}
    const descriptions: Record<string, string> = {}
    if (titlesRaw && typeof titlesRaw === 'object' && !Array.isArray(titlesRaw)) {
      for (const [k, v] of Object.entries(titlesRaw)) {
        if (VALID_LANGS.has(k) && typeof v === 'string' && v.trim()) titles[k] = v.trim()
      }
    }
    if (descRaw && typeof descRaw === 'object' && !Array.isArray(descRaw)) {
      for (const [k, v] of Object.entries(descRaw)) {
        if (VALID_LANGS.has(k) && typeof v === 'string' && v.trim()) descriptions[k] = v.trim()
      }
    }
    return { titles, descriptions }
  } catch {
    return null
  }
}

function buildPrompt(input: {
  sourceLang: string
  title: string
  description: string
  targetLangs: string[]
}): string {
  return `You are a professional tourism listing translator and editor for RentAdria.

Translate the listing title and description from the source language to every target language.

Rules:
- Return only valid JSON.
- JSON shape must be exactly: {"titles":{"lang":"..."}, "descriptions":{"lang":"..."}}
- Preserve all facts, prices, places, rules, phone numbers, dates, amenities, and quantities.
- Do not invent amenities or claims.
- Make the text natural, fluent, and appealing for tourists.
- Keep titles concise and suitable for a listing card.
- Keep descriptions in plain text, no Markdown and no bullet symbols unless the source clearly uses bullets.
- Use Latin script for cnr, hr, bs, and sr.
- Language labels: en=English, sq=Albanian, it=Italian, es=Spanish, cnr=Montenegrin, hr=Croatian, bs=Bosnian, sr=Serbian.

Input JSON:
${JSON.stringify(input, null, 2)}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }

  const ip = clientIp(req)
  if (!rateLimit(`ai-listing-translate:${ip}`, 40, 60_000)) {
    res.status(429).json({ ok: false, error: 'rate_limited' })
    return
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
  const ownerUid = await ownerUserIdFromCookie(cookieHeader)
  if (!ownerUid) {
    res.status(401).json({ ok: false, error: 'owner_auth_required' })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    res.status(503).json({ ok: false, error: 'gemini_not_configured' })
    return
  }

  const body = parseRequestJsonRecord(req)
  const sourceLang = cleanLang(body.sourceLang)
  const title = cleanText(body.title, 600)
  const description = cleanText(body.description, MAX_TEXT_CHARS)
  const targetLangs = Array.isArray(body.targetLangs)
    ? Array.from(new Set(body.targetLangs.map(cleanLang).filter(Boolean))).slice(0, MAX_TARGETS)
    : []

  if (!sourceLang || targetLangs.length === 0 || (!title && !description)) {
    res.status(400).json({ ok: false, error: 'invalid_body' })
    return
  }

  const input = { sourceLang, title, description, targetLangs }
  const key = cacheKey(input)
  const cached = cache.get(key)
  if (cached) {
    res.status(200).json({ ok: true, cached: true, ...cached })
    return
  }

  const model = process.env.GEMINI_TRANSLATE_MODEL?.trim() || 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(input) }] }],
        generationConfig: {
          temperature: 0.25,
          responseMimeType: 'application/json',
        },
      }),
    })
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>
    if (!r.ok) {
      res.status(502).json({ ok: false, error: 'gemini_error' })
      return
    }
    const candidates = Array.isArray(j.candidates) ? j.candidates : []
    const first = candidates[0] as Record<string, unknown> | undefined
    const content = first?.content as Record<string, unknown> | undefined
    const parts = Array.isArray(content?.parts) ? content.parts : []
    const text = parts
      .map((p) => (p && typeof p === 'object' && typeof (p as { text?: unknown }).text === 'string' ? (p as { text: string }).text : ''))
      .join('')
      .trim()
    const parsed = text ? parseGeminiJson(text) : null
    if (!parsed) {
      res.status(502).json({ ok: false, error: 'bad_gemini_response' })
      return
    }
    remember(key, parsed)
    res.status(200).json({ ok: true, cached: false, ...parsed })
  } catch {
    res.status(502).json({ ok: false, error: 'gemini_unavailable' })
  }
}
