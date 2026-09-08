import type { PostgrestError } from '@supabase/supabase-js'

/**
 * Translates the machine-readable codes raised by the PL/pgSQL business
 * functions into text a user can act on.
 *
 * Anything unrecognised is deliberately reported as a generic failure so
 * that raw database internals never leak into the UI.
 */

const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: 'You are not signed in.',
  NOT_AUTHORIZED: 'You are not allowed to perform this action.',
  SERVICE_ROLE_REQUIRED: 'This operation can only run on the server.',
  USER_NOT_FOUND: 'Account not found.',
  ACCOUNT_NOT_ACTIVE: 'Your account is not active. Contact support for details.',

  INSUFFICIENT_BALANCE: 'Your available balance is not enough for this operation.',
  INSUFFICIENT_PENDING_BALANCE: 'The locked amount for this request no longer matches.',
  INVALID_AMOUNT: 'Please enter a valid amount.',
  BALANCE_CHANGES_REQUIRE_LEDGER_ENTRY: 'Balances can only change through the ledger.',
  LEDGER_IS_IMMUTABLE: 'Ledger records cannot be modified.',

  TASK_ALREADY_COMPLETED: 'This task has already been completed today.',
  TASK_ALREADY_CLAIMED: 'This reward has already been claimed.',
  TASK_ALREADY_STARTED: 'This task has already been started.',
  TASK_NOT_STARTED: 'Start the task before claiming the reward.',
  TASK_NOT_AVAILABLE: 'This task is no longer available.',
  ASSIGNMENT_NOT_FOUND: 'Task not found.',
  ASSIGNMENT_EXPIRED: 'This task belongs to a previous day and can no longer be claimed.',
  DAILY_TASK_LIMIT_REACHED: 'You have already completed all of your tasks for today.',
  NO_ACTIVE_VIP_PLAN: 'Activate a VIP plan before claiming task rewards.',
  VIP_PLAN_INACTIVE: 'Your VIP plan is no longer active.',
  REWARD_NOT_CONFIGURED: 'No reward is configured for this task. Contact support.',

  VIP_PLAN_NOT_FOUND: 'That plan does not exist.',
  VIP_PLAN_ALREADY_ACTIVE: 'That plan is already active on your account.',
  VIP_DOWNGRADE_NOT_ALLOWED: 'Moving to a lower VIP level is not permitted.',

  NETWORK_NOT_SUPPORTED: 'That network is not supported.',
  DEPOSITS_DISABLED_FOR_NETWORK: 'Deposits are temporarily disabled for this network.',
  WITHDRAWALS_DISABLED_FOR_NETWORK: 'Withdrawals are temporarily disabled for this network.',
  NO_DEPOSIT_ADDRESS_CONFIGURED: 'No deposit address is configured for this network yet. Contact support.',
  TOO_MANY_OPEN_DEPOSITS: 'You have too many unfinished deposit requests. Complete or cancel them first.',
  DEPOSIT_NOT_FOUND: 'Deposit not found.',
  DEPOSIT_NOT_PENDING: 'This deposit is no longer pending.',
  DEPOSIT_HAS_NO_TX_HASH: 'Submit the transaction hash before verification can run.',
  INVALID_TX_HASH: 'That does not look like a valid transaction hash.',
  TX_HASH_ALREADY_SUBMITTED: 'That transaction hash has already been submitted.',
  TX_HASH_ALREADY_USED: 'That transaction hash is already recorded on another withdrawal.',

  WITHDRAWAL_NOT_FOUND: 'Withdrawal not found.',
  WITHDRAWAL_NOT_CANCELLABLE: 'This withdrawal can no longer be cancelled.',
  WITHDRAWAL_ALREADY_PENDING: 'You already have a withdrawal in progress.',
  INVALID_WITHDRAWAL_STATE: 'This withdrawal is not in a state that allows that action.',
  INVALID_DESTINATION_ADDRESS: 'That wallet address is not valid for the selected network.',
  AMOUNT_DOES_NOT_COVER_FEE: 'The amount must be larger than the network fee.',
  REASON_REQUIRED: 'A written reason is required.',

  INVITATION_CODE_REQUIRED: 'An invitation code is required to register.',
  INVALID_INVITATION_CODE: 'That invitation code is not valid.',
  INVITER_NOT_ACTIVE: 'The account behind that invitation code is not active.',
  SELF_REFERRAL_NOT_ALLOWED: 'You cannot invite yourself.',
  REFERRER_IMMUTABLE: 'Your inviter cannot be changed after registration.',
  REFERRAL_CODE_IMMUTABLE: 'Referral codes cannot be changed.',
  ROLE_OR_STATUS_CHANGE_NOT_AUTHORIZED: 'You are not allowed to change roles or account status.',

  CANNOT_MODIFY_OWN_STATUS: 'You cannot change your own account status.',
  CANNOT_MODIFY_OWN_ROLE: 'You cannot change your own role.',
}

const ELIGIBILITY_MESSAGES: Record<string, string> = {
  NO_ACTIVATION: 'Activate a VIP plan first: the withdrawal waiting period starts from your activation date.',
  ACCOUNT_NOT_ACTIVE: 'Your account is not active.',
  WITHDRAWAL_ALREADY_PENDING: 'You already have a withdrawal in progress.',
  COOLDOWN_ACTIVE: 'Your withdrawal cooldown has not finished yet.',
  FIRST_WITHDRAWAL_WAITING_PERIOD: 'Your first withdrawal is not available yet.',
}

function pluralDays(n: number) {
  return n === 1 ? '1 day' : `${n} days`
}

/**
 * True when a failure is a transport problem rather than a rejection by the
 * service: DNS, TLS, a dropped connection, an unreachable host.
 *
 * Worth separating, because reporting an outage as "invalid credentials"
 * sends people hunting for a password that was never wrong.
 */
export function isTransportError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const e = error as { name?: string; status?: number; code?: string; message?: string; cause?: unknown }

  // supabase-js wraps network faults in AuthRetryableFetchError (status 0).
  if (e.name === 'AuthRetryableFetchError') return true
  if (e.name === 'TypeError' && /fetch failed|network|load failed/i.test(e.message ?? '')) return true
  if (e.status === 0) return true
  if (typeof e.code === 'string' && /^(ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|UND_ERR)/.test(e.code)) {
    return true
  }
  if (/fetch failed/i.test(e.message ?? '')) return true

  return e.cause ? isTransportError(e.cause) : false
}

export const SERVICE_UNAVAILABLE_MESSAGE =
  'Could not reach the authentication service. Check your connection and try again in a moment.'

export const EMAIL_NOT_CONFIRMED_MESSAGE =
  'This account still needs to be confirmed. Open the confirmation link we emailed you, then sign in.'

/**
 * True when the account exists and the password was accepted, but the email
 * address has never been confirmed.
 *
 * Reported separately from a bad password on purpose. The generic message
 * exists to stop an attacker discovering which addresses are registered, but
 * it leaks nothing here: registration already answers that question, and
 * hiding it only strands the account owner on "invalid password" forever,
 * with nothing they can do about it.
 */
export function isEmailNotConfirmed(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string }
  return e.code === 'email_not_confirmed' || /email not confirmed/i.test(e.message ?? '')
}

export function mapDbError(error: PostgrestError | Error | null | undefined): string {
  if (!error) return 'Something went wrong. Please try again.'

  const raw = ('message' in error ? error.message : String(error)) || ''

  // Codes with an embedded parameter, e.g. TIMER_NOT_ELAPSED:42
  const timer = raw.match(/TIMER_NOT_ELAPSED:(\d+)/)
  if (timer) {
    const secs = Number(timer[1])
    return `The task timer has not finished yet. ${secs} second${secs === 1 ? '' : 's'} remaining.`
  }

  const eligibility = raw.match(/NOT_ELIGIBLE:([A-Z_]+)/)
  if (eligibility) {
    return ELIGIBILITY_MESSAGES[eligibility[1]] ?? 'You are not eligible to withdraw right now.'
  }

  const minimum = raw.match(/AMOUNT_BELOW_MINIMUM:([\d.]+)/)
  if (minimum) {
    return `The minimum amount for this network is ${Number(minimum[1])} USDT.`
  }

  for (const [code, message] of Object.entries(MESSAGES)) {
    if (raw.includes(code)) return message
  }

  // Constraint names surfaced by Postgres when a race loses.
  if (raw.includes('uq_withdrawal_one_open_per_user')) return MESSAGES.WITHDRAWAL_ALREADY_PENDING
  if (raw.includes('uq_deposit_network_txhash')) return MESSAGES.TX_HASH_ALREADY_SUBMITTED
  if (raw.includes('uq_assignment_user_date_slot') || raw.includes('uq_assignment_user_date_task')) {
    return 'Your tasks for today are already assigned.'
  }
  if (raw.includes('duplicate key value')) return 'That record already exists.'

  if (process.env.NODE_ENV !== 'production') {
    return `Operation failed: ${raw}`
  }
  return 'Something went wrong. Please try again.'
}

export function daysMessage(days: number | null | undefined, prefix: string): string {
  if (days == null) return prefix
  if (days <= 0) return `${prefix} now`
  return `${prefix} in ${pluralDays(days)}`
}

/** Result shape shared by every server action in this codebase. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

export function actionOk<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message }
}

export function actionError(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors }
}
