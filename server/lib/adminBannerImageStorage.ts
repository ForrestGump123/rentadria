import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { getSupabaseAdmin } from './supabaseAdmin.js'

const DEFAULT_BUCKET = 'admin-banners'

export function adminBannersBucket(): string {
  return process.env.SUPABASE_ADMIN_BANNERS_BUCKET?.trim() || DEFAULT_BUCKET
}

/** Path inside bucket from public object URL (…/object/public/<bucket>/<path>). */
export function storageObjectPathFromPublicUrl(url: string): string | null {
  try {
    const u = new URL(url.trim())
    const bucket = adminBannersBucket()
    const needle = `/object/public/${bucket}/`
    const idx = u.pathname.indexOf(needle)
    if (idx === -1) return null
    return decodeURIComponent(u.pathname.slice(idx + needle.length))
  } catch {
    return null
  }
}

export async function deleteAdminBannerObjectAtUrl(imageUrl: string | null | undefined): Promise<void> {
  const path = imageUrl ? storageObjectPathFromPublicUrl(imageUrl) : null
  if (!path) return
  const sb = getSupabaseAdmin()
  if (!sb) return
  const bucket = adminBannersBucket()
  await sb.storage.from(bucket).remove([path])
}

/**
 * Decode data URL, compress to WebP, upload to public bucket.
 * Keeps request bodies off the banners table row.
 */
export async function uploadAdminBannerFromDataUrl(
  dataUrl: string,
): Promise<{ ok: true; publicUrl: string } | { ok: false; error: string }> {
  const raw = dataUrl.trim()
  const m = /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i.exec(raw)
  if (!m) return { ok: false, error: 'invalid_data_url' }

  let buf: Buffer
  try {
    buf = Buffer.from(m[2], 'base64')
  } catch {
    return { ok: false, error: 'invalid_base64' }
  }
  const MAX_IN = 12 * 1024 * 1024
  if (buf.length > MAX_IN) return { ok: false, error: 'image_too_large' }

  let webp: Buffer
  try {
    webp = await sharp(buf)
      .rotate()
      .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 86 })
      .toBuffer()
  } catch {
    return { ok: false, error: 'image_decode_failed' }
  }

  const sb = getSupabaseAdmin()
  if (!sb) return { ok: false, error: 'no_backend' }

  const bucket = adminBannersBucket()
  const path = `public/${randomUUID()}.webp`
  const { error: upErr } = await sb.storage.from(bucket).upload(path, webp, {
    contentType: 'image/webp',
    upsert: false,
  })
  if (upErr) return { ok: false, error: upErr.message }

  const { data } = sb.storage.from(bucket).getPublicUrl(path)
  const publicUrl = data.publicUrl
  if (!publicUrl) return { ok: false, error: 'no_public_url' }
  return { ok: true, publicUrl }
}
