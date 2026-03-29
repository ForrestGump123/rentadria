import { readFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'

export type SocialCardCategory = 'accommodation' | 'car' | 'motorcycle'

export type SocialCardPayload = {
  category: SocialCardCategory
  title: string
  listingPublicId: string
  displayId: string
  location: string
  priceLabel: string
  phone: string
  /** Glavna slika oglasa (data URL, https ili http) */
  imageDataUrl: string | null
}

function categoryLabel(cat: SocialCardCategory): string {
  if (cat === 'car') return 'RENT A CAR'
  if (cat === 'motorcycle') return 'MOTO'
  return 'SMJEŠTAJ'
}

/** Ikona u badgeu (crna na cyan pozadini šablona), viewBox 0 0 24 24. */
function categoryIconSvgInner(cat: SocialCardCategory): string {
  if (cat === 'car') {
    return `<path fill="#0f172a" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>`
  }
  if (cat === 'motorcycle') {
    return `<path fill="#0f172a" d="M17.4 4.5c-.4 0-.8.2-1 .6l-1.4 2.4H9.5L8.3 6.2c-.2-.3-.5-.5-.9-.5H5v2h1.6l.6 1.1-2.3 4.1C4.1 14 3.5 15 3.5 16c0 1.9 1.6 3.5 3.5 3.5S10.5 17.9 10.5 16c0-.4-.1-.8-.2-1.2l1.1-2h3.1l.5 1.8c.3 1.1 1.3 1.9 2.5 1.9 1.4 0 2.5-1.1 2.5-2.5 0-.3 0-.6-.1-.9l-1.8-6.4 1.2-2.1c.1-.2.2-.4.2-.6 0-.6-.4-1-1-1h-1.6zm-8.9 9.5c-.8 0-1.5-.7-1.5-1.5S7.7 11 8.5 11s1.5.7 1.5 1.5S9.3 14 8.5 14zm7.5 3c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1z"/>`
  }
  return `<path fill="#0f172a" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z"/>`
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function truncateVisual(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

/**
 * Šablon 1024×1024: `public/social/sablon-instagram.png` (prazan papir + logo + okvir).
 * Koordinate podešene za taj fajl — ako zamijeniš PNG, prilagodi PHOTO i badge.
 */
const DEFAULT_SIZE = 1024
const PHOTO = { left: 52, top: 228, width: 920, height: 524, radius: 28 }

async function loadListingImageBuffer(imageDataUrl: string | null): Promise<Buffer | null> {
  if (!imageDataUrl) return null
  if (imageDataUrl.startsWith('data:')) {
    const m = /^data:image\/\w+;base64,(.+)$/.exec(imageDataUrl)
    if (!m) return null
    const buf = Buffer.from(m[1], 'base64')
    return buf.length > 0 && buf.length < 12 * 1024 * 1024 ? buf : null
  }
  if (imageDataUrl.startsWith('http://') || imageDataUrl.startsWith('https://')) {
    try {
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), 25_000)
      const res = await fetch(imageDataUrl, { signal: ac.signal })
      clearTimeout(timer)
      if (!res.ok) return null
      const ab = await res.arrayBuffer()
      const buf = Buffer.from(ab)
      return buf.length > 0 && buf.length < 12 * 1024 * 1024 ? buf : null
    } catch {
      return null
    }
  }
  return null
}

export async function renderSocialTemplate(payload: SocialCardPayload): Promise<Buffer> {
  const cwd = process.cwd()
  const templatePath = join(cwd, 'public', 'social', 'sablon-instagram.png')
  const base = await readFile(templatePath)

  const meta = await sharp(base).metadata()
  const tw = meta.width ?? DEFAULT_SIZE
  const th = meta.height ?? DEFAULT_SIZE
  const scale = tw / DEFAULT_SIZE

  const P = {
    left: Math.round(PHOTO.left * scale),
    top: Math.round(PHOTO.top * scale),
    width: Math.round(PHOTO.width * scale),
    height: Math.round(PHOTO.height * scale),
    radius: Math.round(PHOTO.radius * scale),
  }

  const rawBuf = await loadListingImageBuffer(payload.imageDataUrl)
  let photoLayer: Buffer | null = null
  if (rawBuf) {
    try {
      const maskSvg = Buffer.from(
        `<svg width="${P.width}" height="${P.height}">
          <rect x="0" y="0" width="${P.width}" height="${P.height}" rx="${P.radius}" ry="${P.radius}" fill="white"/>
        </svg>`,
      )
      photoLayer = await sharp(rawBuf)
        .resize(P.width, P.height, { fit: 'cover', position: 'center' })
        .ensureAlpha()
        .composite([{ input: maskSvg, blend: 'dest-in' }])
        .png()
        .toBuffer()
    } catch {
      photoLayer = null
    }
  }

  const cat = categoryLabel(payload.category)
  const titleLine = truncateVisual(`${(payload.title || 'Oglas').trim()} #${payload.displayId}`, 52)
  const locLine = truncateVisual((payload.location || '—').trim(), 56)
  const priceLine = truncateVisual((payload.priceLabel || '—').trim(), 22)
  const phoneLine = truncateVisual((payload.phone || '—').trim(), 28)

  const iconInner = categoryIconSvgInner(payload.category)
  const gradH = Math.round(160 * scale)
  const titleFs = Math.round(30 * scale)
  const locFs = Math.round(20 * scale)
  const priceFs = Math.round(28 * scale)
  const footFs = Math.round(13 * scale)
  const badgeFs = Math.round(17 * scale)
  const iconPx = Math.round(20 * scale)

  const titleY = P.top + P.height - Math.round(78 * scale)
  const locY = P.top + P.height - Math.round(42 * scale)
  const priceY = P.top + P.height - Math.round(42 * scale)

  const badgeX = Math.round(48 * scale)
  const badgeY = Math.round(44 * scale)

  const footCtaY = th - Math.round(34 * scale)
  const footBoxW = Math.round(268 * scale)
  const footBoxH = Math.round(46 * scale)
  const footBoxX = tw - Math.round(40 * scale) - footBoxW
  const footBoxY = th - Math.round(58 * scale)
  const footPhoneCy = footBoxY + footBoxH / 2 + Math.round(5 * scale)

  const overlay = Buffer.from(
    `<svg width="${tw}" height="${th}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="raPhotoGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0a1020" stop-opacity="0"/>
          <stop offset="100%" stop-color="#05080f" stop-opacity="0.82"/>
        </linearGradient>
      </defs>
      <rect x="${P.left}" y="${P.top + P.height - gradH}" width="${P.width}" height="${gradH}" fill="url(#raPhotoGrad)"/>
      <text x="${P.left + Math.round(22 * scale)}" y="${titleY}" fill="#ffffff" font-family="Segoe UI,system-ui,Arial,sans-serif" font-size="${titleFs}" font-weight="700">${escapeXml(titleLine)}</text>
      <text x="${P.left + Math.round(22 * scale)}" y="${locY}" fill="#e8eef5" font-family="Segoe UI,system-ui,Arial,sans-serif" font-size="${locFs}">${escapeXml(locLine)}</text>
      <text x="${P.left + P.width - Math.round(22 * scale)}" y="${priceY}" fill="#22d3ee" font-family="Segoe UI,system-ui,Arial,sans-serif" font-size="${priceFs}" font-weight="700" text-anchor="end">${escapeXml(priceLine)}</text>
      <g transform="translate(${badgeX}, ${badgeY})">
        <svg width="${iconPx}" height="${iconPx}" viewBox="0 0 24 24" aria-hidden="true">${iconInner}</svg>
        <text x="${iconPx + Math.round(8 * scale)}" y="${Math.round(15 * scale)}" fill="#0f172a" font-family="Segoe UI,system-ui,Arial,sans-serif" font-size="${badgeFs}" font-weight="700">${escapeXml(cat)}</text>
      </g>
      <text x="${Math.round(44 * scale)}" y="${footCtaY}" fill="#22d3ee" font-family="Segoe UI,system-ui,Arial,sans-serif" font-size="${footFs}" font-weight="600" letter-spacing="0.04em">PRIKAŽI KONTAKT NA RENTADRIA.COM</text>
      <rect x="${footBoxX}" y="${footBoxY}" width="${footBoxW}" height="${footBoxH}" rx="${Math.round(12 * scale)}" ry="${Math.round(12 * scale)}" fill="none" stroke="#22d3ee" stroke-width="${Math.max(2, Math.round(2 * scale))}"/>
      <path fill="#ffffff" transform="translate(${footBoxX + Math.round(14 * scale)}, ${footBoxY + Math.round(13 * scale)}) scale(${0.62 * scale})" d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
      <text x="${footBoxX + Math.round(38 * scale)}" y="${footPhoneCy}" fill="#ffffff" font-family="Segoe UI,system-ui,Arial,sans-serif" font-size="${Math.round(16 * scale)}" text-anchor="start">${escapeXml(phoneLine)}</text>
    </svg>`,
  )

  const layers: sharp.OverlayOptions[] = []
  if (photoLayer) {
    layers.push({ input: photoLayer, top: P.top, left: P.left })
  }
  layers.push({ input: overlay, top: 0, left: 0 })

  return sharp(base).composite(layers).jpeg({ quality: 90, mozjpeg: true }).toBuffer()
}
