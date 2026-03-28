/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOCIAL_ENQUEUE_SECRET?: string
  /** Isti string kao SITE_VISITS_READ_SECRET na serveru — zaštita /api/site-visits-stats */
  readonly VITE_SITE_VISITS_READ_SECRET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.txt?raw' {
  const src: string
  export default src
}
