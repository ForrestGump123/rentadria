/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOCIAL_ENQUEUE_SECRET?: string
  /** Isti string kao SITE_VISITS_READ_SECRET na serveru — zaštita /api/site-visits-stats */
  readonly VITE_SITE_VISITS_READ_SECRET?: string
  /** Isti kao ADMIN_SYNC_SECRET na Vercelu — /api/admin-sync */
  readonly VITE_ADMIN_SYNC_SECRET?: string
  /** Supabase project URL (Settings → API) — za `getSupabaseBrowser()` */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon/public key — samo za operacije koje dozvoljava RLS */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.txt?raw' {
  const src: string
  export default src
}
