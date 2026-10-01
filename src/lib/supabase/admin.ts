import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { publicEnv, serverEnv } from '@/lib/env'

let cached: SupabaseClient | null = null

/**
 * Service-role client. Bypasses RLS entirely.
 *
 * Only these server-only tasks are allowed to use it:
 *   1. blockchain deposit verification (credit_verified_deposit)
 *   2. the scheduled verification job
 *   3. registration pre-checks that must read across users
 *   4. admin user invitations through Supabase Auth
 *
 * It must never be imported into a Client Component. The `server-only`
 * import above turns any such attempt into a build error.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  if (cached) return cached

  const pub = publicEnv()
  const srv = serverEnv()

  cached = createClient(pub.NEXT_PUBLIC_SUPABASE_URL, srv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { 'X-Client-Info': 'property-tasks-platform/server' } },
  })

  return cached
}
