import { PROFANITY_BLOCKLIST } from '../constants/profanityBlocklist'

/** Uklanja dijakritike za usporedbu s blok-listom. */
function normalizeForMatch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

function isBlockedWord(normalized: string): boolean {
  if (!normalized) return false
  return PROFANITY_BLOCKLIST.has(normalized)
}

/** Prvo slovo/grafema ostaje, ostatak riječi zamijenjen zvjezdicama. */
function maskToken(raw: string): string {
  const chars = [...raw]
  if (chars.length === 0) return raw
  if (chars.length === 1) return '*'
  return chars[0] + '*'.repeat(chars.length - 1)
}

/**
 * Maskira riječi koje su na blok-listi (cjelovite tokene: slova/brojevi).
 * Ostavlja prvo slovo, ostatak zvjezdice — radi za latinicu i ćirilicu.
 */
export function maskProfanity(text: string): string {
  if (!text) return text
  return text.replace(/[\p{L}\p{N}]+/gu, (token) => {
    const norm = normalizeForMatch(token)
    if (norm && isBlockedWord(norm)) return maskToken(token)
    return token
  })
}
