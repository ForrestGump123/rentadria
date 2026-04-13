import { sha256Hex } from './passwordHash'
import { findOwnerProfileByEmail, saveOwnerProfile, type OwnerProfile } from './ownerSession'

/**
 * Samo `npm run dev`: ako su u `.env.local` postavljeni VITE_LOCAL_OWNER_*,
 * jednom kreira vlasnički profil u localStorage (bez servera).
 * Nikad ne postavljaj ove VITE_* varijable na Vercelu.
 */
export async function runLocalDevOwnerSeed(): Promise<void> {
  if (!import.meta.env.DEV) return
  if (import.meta.env.VITE_LOCAL_OWNER_SEED !== '1') return
  const email = import.meta.env.VITE_LOCAL_OWNER_EMAIL?.trim().toLowerCase()
  const password = import.meta.env.VITE_LOCAL_OWNER_PASSWORD
  if (!email || !password) return
  if (findOwnerProfileByEmail(email)) return

  const profile: OwnerProfile = {
    userId: email,
    email,
    displayName: email.split('@')[0] || 'Owner',
    plan: null,
    subscriptionActive: false,
    registeredAt: new Date().toISOString(),
    validUntil: '',
    passwordHash: await sha256Hex(password),
  }
  saveOwnerProfile(profile)
}
