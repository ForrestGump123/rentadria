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
  /** Glavna slika oglasa (data URL ili https) */
  imageDataUrl: string | null
}

function categoryLabel(cat: SocialCardCategory): string {
  if (cat === 'car') return 'AUTO'
  if (cat === 'motorcycle') return 'MOTO'
  return 'SMJEŠTAJ'
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Koordinate za 1080×1080 šablon — podešavaj po potrebi. */
const W = 1080
const PHOTO = { left: 56, top: 268, width: 968, height: 520, radius: 28 }

export async function renderSocialTemplate(payload: SocialCardPayload): Promise<Buffer> {
  const cwd = process.cwd()
  const templatePath = join(cwd, 'public', 'social', 'sablon-instagram.png')
  const base = await readFile(templatePath)

  const meta = await sharp(base).metadata()
  const tw = meta.width ?? W
  const th = meta.height ?? W

  let photoLayer: Buffer | null = null
  if (payload.imageDataUrl?.startsWith('data:')) {
    const m = /^data:image\/\w+;base64,(.+)$/.exec(payload.imageDataUrl)
    if (m) {
      const buf = Buffer.from(m[1], 'base64')
      if (buf.length > 0 && buf.length < 12 * 1024 * 1024) {
        const maskSvg = Buffer.from(
          `<svg width="${PHOTO.width}" height="${PHOTO.height}">
            <rect x="0" y="0" width="${PHOTO.width}" height="${PHOTO.height}" rx="${PHOTO.radius}" ry="${PHOTO.radius}" fill="white"/>
          </svg>`,
        )
        photoLayer = await sharp(buf)
          .resize(PHOTO.width, PHOTO.height, { fit: 'cover', position: 'center' })
          .ensureAlpha()
          .composite([{ input: maskSvg, blend: 'dest-in' }])
          .png()
          .toBuffer()
      }
    }
  }

  const cat = categoryLabel(payload.category)
  const titleLine = escapeXml(`${payload.title} #${payload.displayId}`)
  const locLine = escapeXml(payload.location)
  const priceLine = escapeXml(payload.priceLabel)
  const phoneLine = escapeXml(payload.phone || '—')

  const overlay = Buffer.from(
    `<svg width="${tw}" height="${th}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0a1020" stop-opacity="0"/>
          <stop offset="100%" stop-color="#05080f" stop-opacity="0.75"/>
        </linearGradient>
      </defs>
      <rect x="${PHOTO.left}" y="${PHOTO.top + PHOTO.height - 140}" width="${PHOTO.width}" height="140" fill="url(#g)"/>
      <text x="${PHOTO.left + 24}" y="${PHOTO.top + PHOTO.height - 72}" fill="#ffffff" font-family="system-ui,Segoe UI,Arial,sans-serif" font-size="34" font-weight="700">${titleLine}</text>
      <text x="${PHOTO.left + 24}" y="${PHOTO.top + PHOTO.height - 34}" fill="#e2e8f0" font-family="system-ui,Segoe UI,Arial,sans-serif" font-size="22">${locLine}</text>
      <text x="${PHOTO.left + PHOTO.width - 24}" y="${PHOTO.top + PHOTO.height - 34}" fill="#22d3ee" font-family="system-ui,Segoe UI,Arial,sans-serif" font-size="30" font-weight="700" text-anchor="end">${priceLine}</text>
      <text x="56" y="${th - 36}" fill="#22d3ee" font-family="system-ui,Segoe UI,Arial,sans-serif" font-size="20" font-weight="600">PRIKAŽI KONTAKT NA RENTADRIA.COM</text>
      <rect x="${tw - 320}" y="${th - 58}" width="260" height="44" rx="10" ry="10" fill="none" stroke="#22d3ee" stroke-width="2"/>
      <text x="${tw - 190}" y="${th - 30}" fill="#22d3ee" font-family="system-ui,Segoe UI,Arial,sans-serif" font-size="20" text-anchor="middle">📞 ${phoneLine}</text>
      <text x="72" y="92" fill="#ffffff" font-family="system-ui,Segoe UI,Arial,sans-serif" font-size="20" font-weight="700">${escapeXml(cat)}</text>
    </svg>`,
  )

  const layers: sharp.OverlayOptions[] = [{ input: overlay, top: 0, left: 0 }]
  if (photoLayer) {
    layers.unshift({ input: photoLayer, top: PHOTO.top, left: PHOTO.left })
  }

  return sharp(base).composite(layers).jpeg({ quality: 88, mozjpeg: true }).toBuffer()
}
