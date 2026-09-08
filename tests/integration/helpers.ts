import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Shared plumbing for the integration suite.
 *
 * These tests talk to a real Postgres instance, because the rules that
 * matter most — the three-tasks-a-day cap, the 180-second timer, withdrawal
 * locking, RLS — live in SQL and cannot be exercised by mocking the client.
 *
 * They are skipped unless the connection details are present, so
 * `npm test` stays runnable with no infrastructure. To run them:
 *
 *   supabase start
 *   SUPABASE_TEST_URL=http://127.0.0.1:54321 \
 *   SUPABASE_TEST_ANON_KEY=<anon key> \
 *   SUPABASE_TEST_SERVICE_ROLE_KEY=<service role key> \
 *   npm test
 *
 * Point them at a disposable database. The suite creates and deletes auth
 * users and writes ledger rows; never aim it at production.
 */

export const TEST_URL = process.env.SUPABASE_TEST_URL
export const TEST_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY
export const TEST_SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY

export const INTEGRATION_ENABLED = Boolean(TEST_URL && TEST_ANON_KEY && TEST_SERVICE_KEY)

export const SKIP_REASON =
  'set SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY and SUPABASE_TEST_SERVICE_ROLE_KEY to run the integration suite'

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Db = SupabaseClient<any, 'public', any>

/** Service-role client: bypasses RLS. Used only for setup and assertions. */
export function adminClient(): Db {
  return createClient(TEST_URL!, TEST_SERVICE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function anonClient(): Db {
  return createClient(TEST_URL!, TEST_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const PASSWORD = 'IntegrationTest9'
const createdUserIds: string[] = []
let counter = 0

export interface TestUser {
  id: string
  email: string
  referralCode: string
  /** A client authenticated as this user, so RLS applies exactly as in the app. */
  db: Db
}

function uniqueEmail(label: string): string {
  counter += 1
  return `it-${label}-${process.pid.toString(36)}-${counter}-${Date.now().toString(36)}@example.test`.toLowerCase()
}

/**
 * Creates a confirmed auth user and signs in as them.
 *
 * The invitation code travels in user metadata, exactly as the registration
 * server action sends it, so `handle_new_user` sees the same input here as
 * it does in production.
 */
export async function createUser(admin: Db, label: string, referralCode?: string): Promise<TestUser> {
  const email = uniqueEmail(label)

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: referralCode ? { referral_code: referralCode, username: label } : { username: label },
  })
  if (error || !data.user) throw new Error(`createUser(${label}) failed: ${error?.message}`)

  createdUserIds.push(data.user.id)

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('referral_code')
    .eq('id', data.user.id)
    .single()
  if (profileError) throw new Error(`profile for ${label} was not created: ${profileError.message}`)

  const db = anonClient()
  const { error: signInError } = await db.auth.signInWithPassword({ email, password: PASSWORD })
  if (signInError) throw new Error(`sign-in for ${label} failed: ${signInError.message}`)

  return { id: data.user.id, email, referralCode: profile.referral_code as string, db }
}

/** Runs a registration that is expected to be refused; returns the message. */
export async function createUserExpectingFailure(admin: Db, label: string, referralCode?: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: uniqueEmail(label),
    password: PASSWORD,
    email_confirm: true,
    user_metadata:
      referralCode === undefined ? { username: label } : { referral_code: referralCode, username: label },
  })

  if (data?.user) {
    createdUserIds.push(data.user.id)
    throw new Error(`registration for ${label} unexpectedly succeeded`)
  }
  return error?.message ?? 'unknown error'
}

/**
 * Makes sure there is a SUPER_ADMIN to act as the operator.
 *
 * On a fresh database the first account becomes SUPER_ADMIN automatically;
 * on a reused one the role is set with the service-role key, which the
 * profile guard permits.
 */
export async function createOperator(admin: Db): Promise<TestUser> {
  const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true })

  let operator: TestUser
  if ((count ?? 0) === 0) {
    operator = await createUser(admin, 'operator')
  } else {
    const { data: root } = await admin
      .from('profiles')
      .select('referral_code')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()
    operator = await createUser(admin, 'operator', root?.referral_code as string | undefined)
  }

  const { error } = await admin.from('profiles').update({ role: 'SUPER_ADMIN' }).eq('id', operator.id)
  if (error) throw new Error(`could not promote the operator account: ${error.message}`)

  return operator
}

/**
 * Funds a test account through the real audited admin path, so the balance
 * only ever moves together with a ledger entry.
 */
export async function creditBalance(operator: TestUser, userId: string, amount: number): Promise<void> {
  const { error } = await operator.db.rpc('admin_adjust_balance', {
    p_user_id: userId,
    p_amount: amount,
    p_reason: 'Integration test funding',
  })
  if (error) throw new Error(`creditBalance failed: ${error.message}`)
}

export async function getProfile(admin: Db, userId: string) {
  const { data, error } = await admin.from('profiles').select('*').eq('id', userId).single()
  if (error) throw new Error(`getProfile failed: ${error.message}`)
  return data
}

export function isoAgo(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString()
}

export function isoDaysAgo(days: number): string {
  return isoAgo(days * 24 * 60 * 60)
}

/** Removes every auth user this run created; profiles cascade from there. */
export async function cleanupUsers(admin: Db): Promise<void> {
  for (const id of createdUserIds.splice(0).reverse()) {
    await admin.auth.admin.deleteUser(id).catch(() => undefined)
  }
}

export function errorMessage(error: unknown): string {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message)
  return String(error)
}

/** The active VIP plan with the lowest level, used as the default tier. */
export async function firstVipPlan(admin: Db) {
  const { data, error } = await admin
    .from('vip_plans')
    .select('*')
    .eq('active', true)
    .order('level', { ascending: true })
    .limit(1)
    .single()
  if (error) throw new Error(`no active VIP plan found — run supabase/seed.sql: ${error.message}`)
  return data
}
