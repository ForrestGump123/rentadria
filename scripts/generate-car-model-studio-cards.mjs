/**
 * Generiše sive „studio“ kartice (PNG) za svaki model iz modeli_marki_automobila_1970_2026.txt.
 * Nije fotorealistični 3D render vozila — uniformna siva pozadina + tipografija (make / model).
 *
 * Pokretanje:
 *   node scripts/generate-car-model-studio-cards.mjs
 *   node scripts/generate-car-model-studio-cards.mjs --limit 20   (test)
 *
 * Izlaz: car-model-studio-renders/<slug-marka>/<slug-modela>.png
 */

import { mkdir, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SOURCE = join(ROOT, 'modeli_marki_automobila_1970_2026.txt')
const OUT = join(ROOT, 'car-model-studio-renders')

const W = 1200
const H = 675

function slug(s) {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'x'
}

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function parseBlocks(raw) {
  const lines = raw.split(/\r?\n/)
  const blocks = []
  let cur = []
  for (const line of lines) {
    if (line.trim() === '') {
      if (cur.length) {
        blocks.push(cur)
        cur = []
      }
    } else {
      cur.push(line.trim())
    }
  }
  if (cur.length) blocks.push(cur)
  return blocks.map((b) => {
    const make = b[0]
    const models = b.slice(1).filter(Boolean)
    return { make, models }
  })
}

function studioSvg(make, model) {
  const mk = escapeXml(make)
  const md = escapeXml(model)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4b4e55"/>
      <stop offset="45%" stop-color="#35383f"/>
      <stop offset="100%" stop-color="#1a1c21"/>
    </linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f1114" stop-opacity="0"/>
      <stop offset="100%" stop-color="#0a0c0f" stop-opacity="0.55"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="0" y="${H * 0.55}" width="${W}" height="${H * 0.45}" fill="url(#floor)"/>
  <ellipse cx="${W / 2}" cy="${H * 0.88}" rx="${W * 0.38}" ry="${H * 0.06}" fill="#050608" opacity="0.45"/>
  <text x="${W / 2}" y="${H * 0.38}" text-anchor="middle" fill="#8b9099" font-family="Segoe UI, system-ui, Arial, sans-serif" font-size="26" font-weight="600" letter-spacing="0.12em">${mk}</text>
  <text x="${W / 2}" y="${H * 0.5}" text-anchor="middle" fill="#e8eaef" font-family="Segoe UI, system-ui, Arial, sans-serif" font-size="44" font-weight="700">${md}</text>
  <text x="${W / 2}" y="${H * 0.92}" text-anchor="middle" fill="#5c6169" font-family="Segoe UI, system-ui, Arial, sans-serif" font-size="14" letter-spacing="0.2em">STUDIO</text>
</svg>`
}

async function main() {
  const args = process.argv.slice(2)
  const limIdx = args.indexOf('--limit')
  const limit = limIdx >= 0 && args[limIdx + 1] ? parseInt(args[limIdx + 1], 10) : 0

  const { readFile } = await import('fs/promises')
  const raw = await readFile(SOURCE, 'utf8')
  const blocks = parseBlocks(raw)

  let total = 0
  const jobs = []
  for (const { make, models } of blocks) {
    if (!models.length) continue
    const makeSlug = slug(make)
    for (const model of models) {
      const modelSlug = slug(model)
      jobs.push({ make, model, makeSlug, modelSlug, outPath: join(OUT, makeSlug, `${modelSlug}.png`) })
    }
  }

  const toRun = limit > 0 ? jobs.slice(0, limit) : jobs
  console.log(`Ukupno modela u listi: ${jobs.length}. Generišem: ${toRun.length}${limit ? ' (limit)' : ''}.`)

  await mkdir(OUT, { recursive: true })

  let n = 0
  for (const j of toRun) {
    await mkdir(dirname(j.outPath), { recursive: true })
    const svg = studioSvg(j.make, j.model)
    const buf = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()
    await writeFile(j.outPath, buf)
    n++
    total++
    if (n % 200 === 0) console.log(`  … ${n} / ${toRun.length}`)
  }

  console.log(`Gotovo. PNG fajlova: ${total} → ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
