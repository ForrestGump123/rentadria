import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { adminAuthDevPlugin } from './server/viteAdminAuthPlugin.ts'

/** Production base path. Default `/` for Vercel, Netlify, custom domains. */
function productionBase(): string {
  const raw = process.env.VITE_BASE_PATH?.trim()
  if (!raw || raw === '/') return '/'
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`
  return withSlash.endsWith('/') ? withSlash : `${withSlash}/`
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), adminAuthDevPlugin()],
  base: command === 'build' ? productionBase() : '/',
  server: {
    proxy: {
      '/api/lt': {
        target: 'https://libretranslate.de',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/lt/, ''),
        secure: true,
      },
      '/api/lt2': {
        target: 'https://translate.argosopentech.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/lt2/, ''),
        secure: true,
      },
    },
  },
}))
