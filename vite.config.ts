import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Production base path. Default `/` for Vercel, Netlify, custom domains. */
function productionBase(): string {
  const raw = process.env.VITE_BASE_PATH?.trim()
  if (!raw || raw === '/') return '/'
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`
  return withSlash.endsWith('/') ? withSlash : `${withSlash}/`
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? productionBase() : '/',
}))
