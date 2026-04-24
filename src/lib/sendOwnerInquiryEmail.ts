/** Isti kanal kao registracija: Vercel `/api/notify-owner-inquiry` (Brevo). */

export type OwnerInquiryEmailPayload = {
  toEmail: string
  ownerUserId?: string
  listingTitle: string
  listingId: string
  guestFirst: string
  guestLast: string
  guestEmail: string
  guestPhone: string
  period: string
  guests: string
  message: string
}

export async function sendOwnerInquiryEmail(payload: OwnerInquiryEmailPayload): Promise<void> {
  const res = await fetch('/api/notify-owner-inquiry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || `http_${res.status}`)
  }
}
