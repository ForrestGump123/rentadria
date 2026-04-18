import { sha256Hex } from './passwordHash'
import {
  addOneYearIso,
  findOwnerProfileByEmail,
  saveOwnerProfile,
  type OwnerProfile,
} from './ownerSession'

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
  const force = import.meta.env.VITE_LOCAL_OWNER_FORCE === '1'
  if (!force && findOwnerProfileByEmail(email)) return

  /** Pro + aktivna pretplata da se odmah vidi pun vlasnički panel (bez onboardinga). */
  const profile: OwnerProfile = {
    userId: email,
    email,
    displayName: import.meta.env.VITE_LOCAL_OWNER_NAME?.trim() || email.split('@')[0] || 'Owner',
    plan: 'pro',
    subscriptionActive: true,
    registeredAt: new Date().toISOString(),
    validUntil: addOneYearIso(),
    passwordHash: await sha256Hex(password),
  }
  saveOwnerProfile(profile)
}
