import 'server-only'

import { redirect } from 'next/navigation'
import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Profile, VipPlan } from '@/types/database'

export interface SessionContext {
  userId: string
  email: string
  profile: Profile
  vipPlan: VipPlan | null
}

/**
 * Loads the authenticated user together with their profile.
 *
 * Uses `supabase.auth.getUser()`, which validates the JWT against the auth
 * server rather than trusting the cookie contents.
 */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<Profile>()

  if (!profile) return null

  let vipPlan: VipPlan | null = null
  if (profile.current_vip_plan_id) {
    const { data } = await supabase
      .from('vip_plans')
      .select('*')
      .eq('id', profile.current_vip_plan_id)
      .maybeSingle<VipPlan>()
    vipPlan = data ?? null
  }

  return { userId: user.id, email: user.email ?? profile.email, profile, vipPlan }
})

/** Page guard: redirects to /login when there is no valid session. */
export async function requireSession(nextPath?: string): Promise<SessionContext> {
  const session = await getSession()
  if (!session) {
    redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login')
  }
  return session
}

/** Page guard: redirects non-admins away from the admin area. */
export async function requireAdminSession(): Promise<SessionContext> {
  const session = await requireSession('/admin')
  if (session.profile.role !== 'ADMIN' && session.profile.role !== 'SUPER_ADMIN') {
    redirect('/dashboard')
  }
  if (session.profile.status !== 'ACTIVE') {
    redirect('/dashboard')
  }
  return session
}

/**
 * Server-action guard. Returns a discriminated result instead of
 * redirecting, so actions can respond with a structured error.
 */
export async function getActionSession(): Promise<
  { ok: true; session: SessionContext } | { ok: false; error: string }
> {
  const session = await getSession()
  if (!session) return { ok: false, error: 'You are not signed in.' }
  if (session.profile.status !== 'ACTIVE') {
    return { ok: false, error: `Your account is ${session.profile.status.toLowerCase()}.` }
  }
  return { ok: true, session }
}

export async function getAdminActionSession(): Promise<
  { ok: true; session: SessionContext } | { ok: false; error: string }
> {
  const result = await getActionSession()
  if (!result.ok) return result
  const { role } = result.session.profile
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    return { ok: false, error: 'Administrator privileges are required.' }
  }
  return result
}
