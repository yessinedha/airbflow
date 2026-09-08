import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { publicEnv } from '@/lib/env'

/**
 * Request-scoped Supabase client bound to the caller's session cookies.
 *
 * RPCs invoked through this client see a real `auth.uid()`, which is what
 * every business function authorises against. Use this for anything acting
 * *as the user*.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  const env = publicEnv()

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component: the middleware refreshes the
          // session cookies instead, so this is safe to swallow.
        }
      },
    },
  })
}

/** Read-only variant for Server Components that must not attempt cookie writes. */
export async function createSupabaseReadOnlyClient() {
  const cookieStore = await cookies()
  const env = publicEnv()

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll() {
        /* no-op */
      },
    },
  })
}
