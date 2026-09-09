import { z } from 'zod'

/**
 * Environment access.
 *
 * Public values are read through `publicEnv` and are safe in the browser.
 * Secrets are only reachable through `serverEnv()`, which throws if it is
 * ever evaluated in a browser bundle.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
})

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  CRON_SECRET: z.string().min(16).optional(),

  // Blockchain providers. Verification for a network is simply disabled
  // when its provider is not configured; nothing is ever auto-credited.
  TRON_API_URL: z.string().url().optional(),
  TRON_API_KEY: z.string().optional(),
  BSC_RPC_URL: z.string().url().optional(),
  ETH_RPC_URL: z.string().url().optional(),
  EVM_RPC_URLS: z.string().optional(),
})

export type PublicEnv = z.infer<typeof publicSchema>
export type ServerEnv = z.infer<typeof serverSchema>

let cachedPublic: PublicEnv | null = null

export function publicEnv(): PublicEnv {
  if (cachedPublic) return cachedPublic

  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  })

  if (!parsed.success) {
    throw new Error(
      'Invalid public environment configuration:\n' +
        parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n') +
        '\nCopy .env.example to .env.local and fill in your Supabase project values.',
    )
  }

  cachedPublic = parsed.data
  return cachedPublic
}

let cachedServer: ServerEnv | null = null

export function serverEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('serverEnv() must never be called from client code')
  }
  if (cachedServer) return cachedServer

  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    TRON_API_URL: process.env.TRON_API_URL,
    TRON_API_KEY: process.env.TRON_API_KEY,
    BSC_RPC_URL: process.env.BSC_RPC_URL,
    ETH_RPC_URL: process.env.ETH_RPC_URL,
    EVM_RPC_URLS: process.env.EVM_RPC_URLS,
  })

  if (!parsed.success) {
    throw new Error(
      'Invalid server environment configuration:\n' +
        parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n'),
    )
  }

  cachedServer = parsed.data
  return cachedServer
}

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  const isLocalhost = explicit?.startsWith('http://localhost:') || explicit?.startsWith('http://127.0.0.1:')

  // Never generate production email links pointing to a developer's machine.
  // This also protects deployments where NEXT_PUBLIC_SITE_URL was accidentally
  // copied from .env.local into Vercel.
  if (explicit && !(isLocalhost && process.env.VERCEL)) return explicit.replace(/\/$/, '')
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}
