import { describe, expect, it } from 'vitest'
import {
  actionError,
  actionOk,
  daysMessage,
  isEmailNotConfirmed,
  isTransportError,
  mapDbError,
} from '@/lib/security/errors'
import {
  explorerUrl,
  formatAmount,
  formatDuration,
  formatPercent,
  formatSignedUsdt,
  formatUsdt,
  maskAddress,
  shortHash,
  toNumber,
} from '@/lib/format'
import { utcDayStart, utcToday } from '@/lib/dashboard/queries'

/**
 * The database raises machine-readable codes; this layer turns them into
 * something a user can act on. A code that fell through to the generic
 * message would leave people stuck, and a raw Postgres message reaching the
 * UI would leak schema internals.
 */
describe('mapDbError', () => {
  it.each([
    ['DAILY_TASK_LIMIT_REACHED', /all of your tasks for today/i],
    ['TASK_ALREADY_CLAIMED', /already been claimed/i],
    ['INSUFFICIENT_BALANCE', /balance is not enough/i],
    ['WITHDRAWAL_ALREADY_PENDING', /already have a withdrawal in progress/i],
    ['INVALID_INVITATION_CODE', /not valid/i],
    ['SELF_REFERRAL_NOT_ALLOWED', /cannot invite yourself/i],
    ['NO_ACTIVE_VIP_PLAN', /activate a vip plan/i],
    ['TX_HASH_ALREADY_SUBMITTED', /already been submitted/i],
    ['LEDGER_IS_IMMUTABLE', /cannot be modified/i],
    ['CANNOT_MODIFY_OWN_ROLE', /own role/i],
  ])('maps %s to a readable message', (code, pattern) => {
    expect(mapDbError(new Error(`ERROR: ${code}`))).toMatch(pattern)
  })

  it('extracts the remaining seconds from a timer rejection', () => {
    expect(mapDbError(new Error('TIMER_NOT_ELAPSED:42'))).toMatch(/42 seconds remaining/)
    expect(mapDbError(new Error('TIMER_NOT_ELAPSED:1'))).toMatch(/1 second remaining/)
  })

  it('explains why a withdrawal is not eligible', () => {
    expect(mapDbError(new Error('NOT_ELIGIBLE:FIRST_WITHDRAWAL_WAITING_PERIOD'))).toMatch(/first withdrawal/i)
    expect(mapDbError(new Error('NOT_ELIGIBLE:COOLDOWN_ACTIVE'))).toMatch(/cooldown/i)
    expect(mapDbError(new Error('NOT_ELIGIBLE:SOMETHING_NEW'))).toMatch(/not eligible/i)
  })

  it('reports the configured minimum when an amount is below it', () => {
    expect(mapDbError(new Error('AMOUNT_BELOW_MINIMUM:10'))).toMatch(/minimum amount for this network is 10 USDT/)
  })

  it('translates unique-constraint names raised by a lost race', () => {
    expect(mapDbError(new Error('duplicate key value violates unique constraint "uq_withdrawal_one_open_per_user"')))
      .toMatch(/already have a withdrawal in progress/i)
    expect(mapDbError(new Error('violates unique constraint "uq_deposit_network_txhash"')))
      .toMatch(/already been submitted/i)
    expect(mapDbError(new Error('violates unique constraint "uq_assignment_user_date_slot"')))
      .toMatch(/already assigned/i)
  })

  it('falls back to a generic message for null input', () => {
    expect(mapDbError(null)).toMatch(/something went wrong/i)
  })
})

/**
 * A network outage must never be reported to a user as "invalid password".
 * Getting this wrong once already cost an afternoon of debugging a password
 * that was correct all along.
 */
describe('isTransportError', () => {
  it('recognises the supabase-js wrapper for a network fault', () => {
    const error = Object.assign(new Error('Failed to fetch'), { name: 'AuthRetryableFetchError', status: 0 })
    expect(isTransportError(error)).toBe(true)
  })

  it('recognises a bare undici fetch failure', () => {
    expect(isTransportError(new TypeError('fetch failed'))).toBe(true)
  })

  it('follows the cause chain to a socket errno', () => {
    const inner = Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' })
    const outer = Object.assign(new TypeError('fetch failed'), { cause: inner })
    expect(isTransportError(outer)).toBe(true)
  })

  it.each([
    ['ECONNREFUSED'],
    ['ECONNRESET'],
    ['ETIMEDOUT'],
    ['EAI_AGAIN'],
    ['UND_ERR_CONNECT_TIMEOUT'],
  ])('recognises %s', (code) => {
    expect(isTransportError(Object.assign(new Error('socket'), { code }))).toBe(true)
  })

  it('does NOT treat a rejected credential as a transport failure', () => {
    const error = Object.assign(new Error('Invalid login credentials'), {
      name: 'AuthApiError',
      status: 400,
    })
    expect(isTransportError(error)).toBe(false)
  })

  it('does not treat an ordinary business error as a transport failure', () => {
    expect(isTransportError(new Error('DAILY_TASK_LIMIT_REACHED'))).toBe(false)
    expect(isTransportError(null)).toBe(false)
    expect(isTransportError('fetch failed')).toBe(false)
  })
})

describe('isEmailNotConfirmed', () => {
  it('recognises the Supabase code', () => {
    expect(isEmailNotConfirmed({ code: 'email_not_confirmed', message: 'Email not confirmed' })).toBe(true)
  })

  it('recognises the message when no code is supplied', () => {
    expect(isEmailNotConfirmed(new Error('Email not confirmed'))).toBe(true)
  })

  it('does not confuse it with a wrong password', () => {
    expect(isEmailNotConfirmed({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe(false)
    expect(isEmailNotConfirmed(new TypeError('fetch failed'))).toBe(false)
    expect(isEmailNotConfirmed(null)).toBe(false)
  })
})

describe('daysMessage', () => {
  it('reads naturally for one day, several days and none', () => {
    expect(daysMessage(1, 'Available')).toBe('Available in 1 day')
    expect(daysMessage(10, 'Available')).toBe('Available in 10 days')
    expect(daysMessage(0, 'Available')).toBe('Available now')
    expect(daysMessage(null, 'Available')).toBe('Available')
  })
})

describe('ActionResult helpers', () => {
  it('builds a success result carrying data and a message', () => {
    const result = actionOk({ id: 'x' }, 'Saved.')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.id).toBe('x')
    expect(result.message).toBe('Saved.')
  })

  it('builds a failure result carrying field errors', () => {
    const result = actionError('Fix the fields.', { amount: ['Too small'] })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.fieldErrors?.amount).toEqual(['Too small'])
  })
})

/**
 * Amounts come back from Postgres `numeric` as strings so precision is not
 * lost in transit; every display path has to cope with that.
 */
describe('money formatting', () => {
  it('accepts the string form Postgres returns', () => {
    expect(formatUsdt('125.00000000')).toBe('125.00 USDT')
    expect(formatUsdt('0.5')).toBe('0.50 USDT')
    expect(formatAmount('1234.5')).toBe('1,234.50')
  })

  it('treats null and undefined as zero rather than NaN', () => {
    expect(toNumber(null)).toBe(0)
    expect(toNumber(undefined)).toBe(0)
    expect(toNumber('not a number')).toBe(0)
    expect(formatUsdt(null)).toBe('0.00 USDT')
  })

  it('signs ledger movements so credits and debits are distinguishable', () => {
    expect(formatSignedUsdt('4.5')).toBe('+4.50 USDT')
    expect(formatSignedUsdt('-80')).toBe('-80.00 USDT')
    expect(formatSignedUsdt(0)).toBe('0.00 USDT')
  })

  it('renders a reward rate as a percentage', () => {
    expect(formatPercent(0.03)).toBe('3.00%')
    expect(formatPercent('0.005', 3)).toBe('0.500%')
  })
})

describe('formatDuration', () => {
  it('renders the task timer as mm:ss', () => {
    expect(formatDuration(180)).toBe('03:00')
    expect(formatDuration(59)).toBe('00:59')
    expect(formatDuration(0)).toBe('00:00')
  })

  it('never renders a negative countdown', () => {
    expect(formatDuration(-5)).toBe('00:00')
  })
})

describe('hash and address display', () => {
  it('shortens a long hash but leaves a short one intact', () => {
    const hash = `0x${'a'.repeat(64)}`
    expect(shortHash(hash)).toContain('…')
    expect(shortHash('0xabc')).toBe('0xabc')
    expect(shortHash(null)).toBe('—')
  })

  it('masks the middle of a wallet address', () => {
    expect(maskAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')).toContain('…')
  })

  it('builds an explorer link only when both template and hash exist', () => {
    expect(explorerUrl('https://tronscan.org/#/transaction/{hash}', 'abc')).toBe(
      'https://tronscan.org/#/transaction/abc',
    )
    expect(explorerUrl(null, 'abc')).toBeNull()
    expect(explorerUrl('https://x/{hash}', null)).toBeNull()
  })
})

/**
 * The daily task cycle is keyed on the UTC date in SQL (`app_today()`), so
 * the application must compute the same boundary or the two would disagree
 * for users in a positive or negative offset.
 */
describe('UTC day boundary', () => {
  it('matches the SQL day boundary regardless of local time zone', () => {
    const lateUtc = new Date('2026-08-20T23:59:59.000Z')
    expect(utcToday(lateUtc)).toBe('2026-08-20')
    expect(utcDayStart(lateUtc)).toBe('2026-08-20T00:00:00.000Z')
  })

  it('rolls over exactly at midnight UTC', () => {
    expect(utcToday(new Date('2026-08-21T00:00:00.000Z'))).toBe('2026-08-21')
    expect(utcToday(new Date('2026-08-20T00:00:00.000Z'))).toBe('2026-08-20')
  })
})
