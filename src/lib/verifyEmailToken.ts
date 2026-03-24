export async function verifyEmailToken(token: string): Promise<{ email: string; name: string; plan: string }> {
  const res = await fetch('/api/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  const data = (await res.json()) as { ok?: boolean; email?: string; name?: string; plan?: string; error?: string }
  if (!res.ok || !data.ok || !data.email) {
    throw new Error(data.error || 'verify_failed')
  }
  return {
    email: data.email,
    name: data.name ?? '',
    plan: data.plan ?? 'basic',
  }
}
