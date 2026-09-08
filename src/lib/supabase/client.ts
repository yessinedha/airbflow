'use client'

import { createBrowserClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'

/**
 * Browser Supabase client. Uses the anon key only; every row it can reach
 * is gated by RLS. It is never used for money movement.
 */
export function createClient() {
  const env = publicEnv()
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}
