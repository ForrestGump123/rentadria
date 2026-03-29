/** Poziva Vercel serverless /api/send-verification (Brevo). */
export async function sendVerificationEmail(payload: {
  email: string
  name: string
  plan: string
}): Promise<void> {
  const res = await fetch('/api/send-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || `http_${res.status}`)
  }
}
