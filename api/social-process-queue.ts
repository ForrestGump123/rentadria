import type { VercelRequest, VercelResponse } from '@vercel/node'
import { listingDisplayId } from '../server/lib/listingDisplayId.js'
import { publishFacebookPagePhoto, publishInstagramFeed } from '../server/lib/publishMetaSocial.js'
import { renderSocialTemplate, type SocialCardCategory } from '../server/lib/renderSocialTemplate.js'
import { getSupabaseAdmin } from '../server/lib/supabaseAdmin.js'

function authorizeCron(req: VercelRequest): boolean {
  if (process.env.VERCEL === '1' && String(req.headers['x-vercel-cron'] ?? '') === '1') {
    return true
  }
  const expected = process.env.CRON_SECRET?.trim()
  if (!expected) return process.env.NODE_ENV !== 'production'
  const auth = String(req.headers.authorization ?? '')
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const q = req.query?.secret
  const qsecret = typeof q === 'string' ? q : Array.isArray(q) ? q[0] : ''
  return bearer === expected || qsecret === expected
}

type QueuePayload = {
  title: string
  location: string
  priceLabel: string
  phone: string
  imageDataUrl: string | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!authorizeCron(req)) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    res.status(503).json({ error: 'supabase_not_configured' })
    return
  }

  const siteUrl = process.env.SITE_URL?.replace(/\/$/, '') || 'https://rentadria.com'

  const { data: row, error: findErr } = await supabase
    .from('social_queue')
    .select('id, listing_public_id, category, payload, scheduled_for')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (findErr) {
    console.error('social_queue select', findErr.message)
    res.status(500).json({ error: findErr.message })
    return
  }

  if (!row) {
    res.status(200).json({ ok: true, processed: false, reason: 'empty' })
    return
  }

  const id = row.id as string
  const listingPublicId = String(row.listing_public_id)
  const cat = row.category as SocialCardCategory
  const payload = row.payload as QueuePayload

  const { error: lockErr } = await supabase
    .from('social_queue')
    .update({ status: 'processing' })
    .eq('id', id)
    .eq('status', 'pending')

  if (lockErr) {
    res.status(200).json({ ok: true, processed: false, reason: 'lock_failed' })
    return
  }

  const displayId = listingDisplayId(listingPublicId)

  try {
    const jpeg = await renderSocialTemplate({
      category: cat,
      title: payload.title || 'RentAdria',
      listingPublicId,
      displayId,
      location: payload.location || '—',
      priceLabel: payload.priceLabel || '—',
      phone: payload.phone || '',
      imageDataUrl: payload.imageDataUrl,
    })

    const bucket = process.env.SUPABASE_SOCIAL_BUCKET?.trim() || 'social-render'
    const path = `queue/${id}.jpg`

    const { error: upErr } = await supabase.storage.from(bucket).upload(path, jpeg, {
      contentType: 'image/jpeg',
      upsert: true,
    })

    if (upErr) throw new Error(upErr.message)

    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
    const imageUrl = pub.publicUrl

    const listingUrl = `${siteUrl}/listing/${encodeURIComponent(listingPublicId)}`
    const titleFromSite = (payload.title || 'Oglas').trim()
    const titleLine = `${titleFromSite} #${displayId}`
    const phoneLine = payload.phone?.trim() || '—'

    /** Univerzalni caption (Instagram + Facebook); podaci po oglasu iz payloada reda. */
    let caption = [
      `🌊 ${titleLine} 🏠`,
      '',
      'Tražite savršen boravak ili prevoz na Jadranu i Mediteranu? Povežite se direktno sa vlasnikom i uštedite na provizijama.',
      '',
      `🔗 Detaljnije na: ${listingUrl}`,
      `📞 Kontaktirajte vlasnika direktno: ${phoneLine}`,
      '',
      '#RentAdria #Travel #Montenegro #BalkanTravel #Accommodation #RentACar #MotoRent #NoCommission',
    ].join('\n')
    if (caption.length > 2100) caption = caption.slice(0, 2100)

    const warnings: string[] = []

    let instagramMediaId: string | undefined
    try {
      if (process.env.META_IG_USER_ID && process.env.META_ACCESS_TOKEN) {
        instagramMediaId = await publishInstagramFeed(imageUrl, caption)
      } else {
        warnings.push('instagram_skipped_missing_env')
      }
    } catch (e) {
      warnings.push(`instagram:${e instanceof Error ? e.message : String(e)}`)
    }

    let facebookPostId: string | null = null
    try {
      if (process.env.META_PAGE_ID) {
        facebookPostId = await publishFacebookPagePhoto(imageUrl, caption)
      } else {
        warnings.push('facebook_skipped_missing_page_id')
      }
    } catch (e) {
      warnings.push(`facebook:${e instanceof Error ? e.message : String(e)}`)
    }

    if (!instagramMediaId && !facebookPostId) {
      throw new Error(warnings.join('; ') || 'no_social_publish')
    }

    await supabase
      .from('social_queue')
      .update({
        status: 'done',
        processed_at: new Date().toISOString(),
        instagram_media_id: instagramMediaId ?? null,
        facebook_post_id: facebookPostId,
        last_error: warnings.length ? warnings.join('; ') : null,
      })
      .eq('id', id)

    res.status(200).json({ ok: true, processed: true, id, warnings })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('social-process', msg)
    await supabase
      .from('social_queue')
      .update({
        status: 'failed',
        last_error: msg.slice(0, 2000),
        processed_at: new Date().toISOString(),
      })
      .eq('id', id)

    res.status(500).json({ ok: false, error: msg })
  }
}
