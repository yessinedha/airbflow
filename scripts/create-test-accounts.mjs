#!/usr/bin/env node
/**
 * Creates two ready-to-use accounts for manual testing: an administrator and
 * an ordinary member invited by that administrator.
 *
 *   npm run seed:accounts
 *   npm run seed:accounts -- --ready-to-withdraw
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
 * SUPABASE_SERVICE_ROLE_KEY from .env.local (or the environment).
 *
 * The accounts are made through the same paths the application uses:
 *   - the member is provisioned by the `handle_new_user` trigger with a real
 *     invitation code, so the referral row is genuine;
 *   - the member's balance is credited with `admin_adjust_balance`, signed in
 *     as the administrator, so a real ADMIN_ADJUSTMENT ledger entry exists.
 *
 * The one thing it does that the application cannot is set the
 * administrator's role and, with --ready-to-withdraw, move the member's
 * activation date into the past so the 30-day rule can be exercised without
 * waiting a month. Both use the service-role key and are announced below.
 *
 * DEVELOPMENT AND STAGING ONLY. Never run this against a production project:
 * it creates accounts with published passwords.
 */
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const READY_TO_WITHDRAW = process.argv.includes('--ready-to-withdraw')

/* ------------------------------------------------------------------ */
/* Environment                                                         */
/* ------------------------------------------------------------------ */
async function loadEnv() {
  try {
    const raw = await readFile(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of raw.split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!match) continue
      const [, key, value] = match
      if (process.env[key] === undefined) {
        process.env[key] = value.replace(/^["']|["']$/g, '').trim()
      }
    }
  } catch {
    // No .env.local: fall back to whatever is already in the environment.
  }
}

await loadEnv()

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL_ || !ANON || !SERVICE) {
  console.error(
    'Missing configuration. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY\n' +
      'and SUPABASE_SERVICE_ROLE_KEY in .env.local first (see .env.example).',
  )
  process.exit(1)
}

if (/\.supabase\.co/.test(URL_) && !process.env.ALLOW_REMOTE_TEST_ACCOUNTS) {
  console.error(
    `Refusing to create test accounts on a hosted project (${URL_}).\n` +
      'These accounts have passwords published in the repository.\n' +
      'If this really is a throwaway staging project, re-run with ALLOW_REMOTE_TEST_ACCOUNTS=1.',
  )
  process.exit(1)
}

const admin = createClient(URL_, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

const ACCOUNTS = {
  admin: { email: 'admin@propverify.test', password: 'AdminTest123', username: 'admin' },
  user: { email: 'user@propverify.test', password: 'UserTest123', username: 'testuser' },
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function fail(step, error) {
  console.error(`\n✗ ${step}: ${error?.message ?? error}`)
  process.exit(1)
}

async function findAuthUser(email) {
  // The admin list API is paginated; the test project is small enough that a
  // couple of pages always cover it.
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) fail('listing existing users', error)
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (match) return match
    if (data.users.length < 200) return null
  }
  return null
}

async function deleteIfExists(email) {
  const existing = await findAuthUser(email)
  if (existing) {
    const { error } = await admin.auth.admin.deleteUser(existing.id)
    if (error) fail(`removing the previous ${email}`, error)
    console.log(`  removed the existing ${email}`)
  }
}

async function createAccount({ email, password, username }, referralCode) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: referralCode ? { referral_code: referralCode, username } : { username },
  })
  if (error) fail(`creating ${email}`, error)

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single()
  if (profileError) fail(`reading the profile for ${email}`, profileError)

  return { id: data.user.id, profile }
}

/** A client signed in as one of the accounts, subject to RLS like the app. */
async function signIn({ email, password }) {
  const client = createClient(URL_, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) fail(`signing in as ${email}`, error)
  return client
}

/* ------------------------------------------------------------------ */
/* Run                                                                 */
/* ------------------------------------------------------------------ */
console.log(`\nCreating test accounts on ${URL_}\n`)

// A rerun should be idempotent, so clear out any previous attempt first.
await deleteIfExists(ACCOUNTS.user.email)
await deleteIfExists(ACCOUNTS.admin.email)

// --- Administrator ---------------------------------------------------
const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true })
const isFirstAccount = (count ?? 0) === 0

let inviteForAdmin
if (!isFirstAccount) {
  // The database already has members, so the trigger will demand a real code.
  const { data: root, error } = await admin
    .from('profiles')
    .select('referral_code')
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()
  if (error) fail('finding an existing account to invite the administrator', error)
  inviteForAdmin = root.referral_code
}

const adminAccount = await createAccount(ACCOUNTS.admin, inviteForAdmin)
console.log(`✓ administrator ${ACCOUNTS.admin.email}`)

if (adminAccount.profile.role !== 'SUPER_ADMIN') {
  // Only the very first account on an empty database is promoted
  // automatically. There is deliberately no in-app way to do this.
  const { error } = await admin.from('profiles').update({ role: 'SUPER_ADMIN' }).eq('id', adminAccount.id)
  if (error) fail('promoting the administrator', error)
  console.log('  promoted to SUPER_ADMIN with the service-role key')
} else {
  console.log('  first account on this database, promoted to SUPER_ADMIN by the signup trigger')
}

const adminCode = adminAccount.profile.referral_code
console.log(`  invitation code: ${adminCode}`)

// --- Member ----------------------------------------------------------
const userAccount = await createAccount(ACCOUNTS.user, adminCode)
console.log(`\n✓ member ${ACCOUNTS.user.email}`)
console.log(`  invited by the administrator, invitation code: ${userAccount.profile.referral_code}`)

// --- Fund the member through the audited admin path -------------------
const adminSession = await signIn(ACCOUNTS.admin)
const FUNDING = 500

const { error: adjustError } = await adminSession.rpc('admin_adjust_balance', {
  p_user_id: userAccount.id,
  p_amount: FUNDING,
  p_reason: 'Test account funding (scripts/create-test-accounts.mjs)',
})
if (adjustError) fail('crediting the member', adjustError)
console.log(`  credited ${FUNDING} USDT via admin_adjust_balance, with a matching ledger entry`)

// --- Activate the lowest VIP level so tasks are claimable -------------
const userSession = await signIn(ACCOUNTS.user)

const { data: plan, error: planError } = await admin
  .from('vip_plans')
  .select('*')
  .eq('active', true)
  .order('level', { ascending: true })
  .limit(1)
  .maybeSingle()

if (planError) fail('reading the VIP plans', planError)

if (!plan) {
  console.log('  no active VIP plan found — run supabase/seed.sql, then activate a plan in the app')
} else {
  const { error } = await userSession.rpc('activate_vip', { p_plan_id: plan.id })
  if (error) fail(`activating ${plan.name}`, error)
  console.log(`  activated ${plan.name} (${plan.activation_amount} USDT charged)`)

  const { error: tasksError } = await userSession.rpc('ensure_daily_assignments')
  if (tasksError) fail('issuing the daily tasks', tasksError)
  console.log(`  ${plan.daily_task_limit} tasks issued for today`)
}

// --- Optionally make the member withdrawal-eligible -------------------
if (READY_TO_WITHDRAW) {
  const { data: setting } = await admin
    .from('platform_settings')
    .select('value')
    .eq('key', 'first_withdrawal_wait_days')
    .maybeSingle()

  const waitDays = Number(setting?.value ?? 30)
  const backdated = new Date(Date.now() - (waitDays + 1) * 86_400_000).toISOString()

  const { error } = await admin.from('profiles').update({ first_activation_at: backdated }).eq('id', userAccount.id)
  if (error) fail('backdating the activation date', error)

  console.log(`  activation date moved back ${waitDays + 1} days so a withdrawal can be requested now`)
}

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */
const { data: finalProfile } = await admin
  .from('profiles')
  .select('balance_available')
  .eq('id', userAccount.id)
  .single()

console.log(`
──────────────────────────────────────────────────────────
  ADMIN    ${ACCOUNTS.admin.email}
           ${ACCOUNTS.admin.password}
           → /admin

  MEMBER   ${ACCOUNTS.user.email}
           ${ACCOUNTS.user.password}
           → /dashboard
           balance ${Number(finalProfile?.balance_available ?? 0).toFixed(2)} USDT
           invite link /register?ref=${userAccount.profile.referral_code}
──────────────────────────────────────────────────────────

  Sign in at /login.
${
  READY_TO_WITHDRAW
    ? ''
    : '  The member cannot withdraw yet: the first withdrawal opens 30 days\n' +
      '  after activation. Re-run with --ready-to-withdraw to skip that wait.\n'
}
  Deposits still need a real wallet address in /admin/settings before
  /deposit will issue instructions.
`)
