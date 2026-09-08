import 'server-only'

import { headers } from 'next/headers'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

/**
 * Fixed-window rate limiting backed by Postgres.
 *
 * A database counter is used rather than process memory because Vercel runs
 * many short-lived instances; an in-memory limiter there would be trivially
 * bypassed by spreading requests across instances.
 */

export interface RateLimitRule {
  /** Logical name, becomes part of the bucket key. */
  action: string
  /** Requests allowed inside the window. */
  limit: number
  /** Window length in seconds. */
  windowSeconds: number
}

export const RATE_LIMITS = {
  login: { action: 'login', limit: 10, windowSeconds: 300 },
  resendConfirmation: { action: 'auth.resend', limit: 3, windowSeconds: 900 },
  register: { action: 'register', limit: 5, windowSeconds: 3600 },
  startTask: { action: 'task.start', limit: 30, windowSeconds: 300 },
  claimTask: { action: 'task.claim', limit: 30, windowSeconds: 300 },
  deposit: { action: 'deposit.create', limit: 15, windowSeconds: 3600 },
  depositVerify: { action: 'deposit.verify', limit: 20, windowSeconds: 3600 },
  withdrawal: { action: 'withdrawal.request', limit: 5, windowSeconds: 3600 },
  vipActivate: { action: 'vip.activate', limit: 10, windowSeconds: 3600 },
  adminWrite: { action: 'admin.write', limit: 120, windowSeconds: 300 },
} as const satisfies Record<string, RateLimitRule>

export async function getClientIp(): Promise<string> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return h.get('x-real-ip') ?? h.get('cf-connecting-ip') ?? 'unknown'
}

/**
 * Returns true when the caller is still inside the allowance.
 *
 * Fails open on infrastructure errors: a rate limiter outage must not take
 * the whole platform down, and every protected action re-validates its own
 * business rules regardless.
 */
export async function checkRateLimit(rule: RateLimitRule, identifier: string): Promise<boolean> {
  try {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: `${rule.action}:${identifier}`,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    })
    if (error) {
      console.error('[rate-limit] check failed', error.message)
      return true
    }
    return data === true
  } catch (err) {
    console.error('[rate-limit] unavailable', err)
    return true
  }
}

/** Convenience wrapper keyed by user id, falling back to the request IP. */
export async function guard(rule: RateLimitRule, userId?: string | null): Promise<boolean> {
  const identifier = userId ?? (await getClientIp())
  return checkRateLimit(rule, identifier)
}

export const RATE_LIMIT_MESSAGE = 'Too many requests. Please wait a moment and try again.'
