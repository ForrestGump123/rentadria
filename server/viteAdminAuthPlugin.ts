import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { loadEnv } from 'vite'
import { adminAuthDispatch } from './lib/adminAuthDispatch.js'

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c as Buffer))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        if (!raw.trim()) return resolve({})
        const o = JSON.parse(raw) as unknown
        resolve(o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : {})
      } catch {
        resolve({})
      }
    })
    req.on('error', reject)
  })
}

/** Dev-only: serves POST/GET /api/admin-auth so `npm run dev` works without Vercel CLI. */
export function adminAuthDevPlugin(): Plugin {
  return {
    name: 'rentadria-admin-auth-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req as IncomingMessage).url?.split('?')[0]
        if (url !== '/api/admin-auth') return next()
        const env = loadEnv(server.config.mode, process.cwd(), '')
        Object.assign(process.env, env)
        try {
          const method = (req as IncomingMessage).method ?? 'GET'
          const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined
          let body: Record<string, unknown> = {}
          if (method === 'POST') {
            body = await readJsonBody(req as IncomingMessage)
          }
          const result = await adminAuthDispatch({
            method,
            cookieHeader,
            body,
            ip: '127.0.0.1',
            secureCookie: false,
          })
          const r = res as ServerResponse
          if (result.setCookie) {
            r.setHeader('Set-Cookie', result.setCookie)
          }
          r.setHeader('Content-Type', 'application/json')
          r.statusCode = result.status
          r.end(JSON.stringify(result.json))
        } catch (e) {
          next(e)
        }
      })
    },
  }
}
