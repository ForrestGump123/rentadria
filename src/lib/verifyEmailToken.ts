export async function verifyEmailToken(token: string): Promise<{ email: string; name: string; plan: string }> {
  const res = await fetch('/api/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ token }),
  })
  let data: { ok?: boolean; email?: string; name?: string; plan?: string; error?: string }
  try {
    data = (await res.json()) as { ok?: boolean; email?: string; name?: string; plan?: string; error?: string }
  } catch {
    const e = new Error('bad_response') as Error & { code?: string }
    e.code = 'bad_response'
    throw e
  }
  if (!res.ok || !data.ok || !data.email) {
    const err = data.error || 'verify_failed'
    const e = new Error(err) as Error & { code?: string }
    e.code = err
    throw e
  }
  return {
    email: data.email,
    name: data.name ?? '',
    plan: data.plan ?? 'basic',
  }
}
