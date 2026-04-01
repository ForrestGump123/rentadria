import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null | undefined

/**
 * Klijent za pregledač kad su postavljeni `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY`.
 * Koristi [Supabase](https://supabase.com) kao Postgres + Auth + Realtime kad povežete bazu.
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  if (client === undefined) {
    client = createClient(url, key)
  }
  return client
}
