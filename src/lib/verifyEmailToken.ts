export type VerifyEmailSuccess = {
  email: string
  name: string
  plan: string
  passwordHash?: string
  phone?: string
  countryId?: string
  promoCode?: string
  /** Sa servera nakon verifikacije (Supabase) */
  subscriptionPlan?: string | null
  subscriptionActive?: boolean
  validUntil?: string
  basicCategoryChoice?: string | null
  registeredAt?: string
}

export async function verifyEmailToken(token: string): Promise<VerifyEmailSuccess> {
  const res = await fetch('/api/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ token }),
  })
  let data: {
    ok?: boolean
    email?: string
    name?: string
    plan?: string
    passwordHash?: string
    phone?: string
    countryId?: string
    promoCode?: string
    subscriptionPlan?: string | null
    subscriptionActive?: boolean
    validUntil?: string
    basicCategoryChoice?: string | null
    registeredAt?: string
    error?: string
  }
  try {
    data = (await res.json()) as typeof data
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
    passwordHash: typeof data.passwordHash === 'string' ? data.passwordHash : undefined,
    phone: typeof data.phone === 'string' ? data.phone : undefined,
    countryId: typeof data.countryId === 'string' ? data.countryId : undefined,
    promoCode: typeof data.promoCode === 'string' ? data.promoCode : undefined,
    subscriptionPlan: data.subscriptionPlan,
    subscriptionActive: data.subscriptionActive,
    validUntil: typeof data.validUntil === 'string' ? data.validUntil : undefined,
    basicCategoryChoice: data.basicCategoryChoice ?? undefined,
    registeredAt: typeof data.registeredAt === 'string' ? data.registeredAt : undefined,
  }
}
