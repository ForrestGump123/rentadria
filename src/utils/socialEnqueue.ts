import type { ListingCategory } from '../types'

export type SocialEnqueuePayload = {
  listingPublicId: string
  category: ListingCategory
  title: string
  location: string
  priceLabel: string
  phone: string
  imageDataUrl: string | null
}

/** Šalje oglas u red za Instagram/Facebook (Vercel `/api/social-enqueue`). */
export async function enqueueListingSocial(payload: SocialEnqueuePayload): Promise<void> {
  const secret = import.meta.env.VITE_SOCIAL_ENQUEUE_SECRET?.trim()
  if (!secret) return

  const body = {
    listingPublicId: payload.listingPublicId,
    category: payload.category,
    title: payload.title,
    location: payload.location,
    priceLabel: payload.priceLabel,
    phone: payload.phone,
    imageDataUrl: payload.imageDataUrl,
  }

  const r = await fetch('/api/social-enqueue', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-social-secret': secret,
    },
    body: JSON.stringify(body),
  })

  if (!r.ok) {
    const t = await r.text().catch(() => '')
    console.warn('social-enqueue', r.status, t)
  }
}
