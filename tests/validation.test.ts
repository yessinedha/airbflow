import { describe, expect, it } from 'vitest'
import {
  adjustBalanceSchema,
  amountSchema,
  createDepositSchema,
  emailSchema,
  fieldErrorsOf,
  loginSchema,
  markPaidSchema,
  passwordSchema,
  referralCodeSchema,
  registerSchema,
  requestWithdrawalSchema,
  settingSchema,
  taskSchema,
  txHashSchema,
  usernameSchema,
  vipPlanSchema,
  vipWithdrawalFeeSchema,
  walletAddressSchema,
} from '@/lib/validation/schemas'

/**
 * These schemas are the outer gate on every server action. They are not the
 * only defence — the PL/pgSQL functions re-validate amounts and ownership —
 * but a bad value should never get past this layer in the first place.
 */

const validRegistration = {
  email: 'Member@Example.COM',
  username: 'member_01',
  password: 'CorrectHorse9',
  confirmPassword: 'CorrectHorse9',
  referralCode: 'abc123',
  acceptTerms: 'on',
}

describe('registerSchema', () => {
  it('accepts a complete registration and normalises the input', () => {
    const result = registerSchema.safeParse(validRegistration)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.email).toBe('member@example.com')
    expect(result.data.referralCode).toBe('ABC123')
  })

  it('refuses registration without an invitation code', () => {
    const result = registerSchema.safeParse({ ...validRegistration, referralCode: '' })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(fieldErrorsOf(result.error)).toHaveProperty('referralCode')
  })

  it('refuses a malformed invitation code', () => {
    for (const code of ['abc', 'abc-123', 'THIRTEENCHARSX', 'ab 123']) {
      expect(registerSchema.safeParse({ ...validRegistration, referralCode: code }).success).toBe(false)
    }
  })

  it('refuses mismatched passwords and reports the field', () => {
    const result = registerSchema.safeParse({ ...validRegistration, confirmPassword: 'Different9Pass' })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(fieldErrorsOf(result.error).confirmPassword?.[0]).toMatch(/do not match/i)
  })

  it('refuses registration when the terms are not accepted', () => {
    const { acceptTerms: _omitted, ...withoutTerms } = validRegistration
    expect(registerSchema.safeParse(withoutTerms).success).toBe(false)
  })
})

describe('passwordSchema', () => {
  it('accepts a password meeting every rule', () => {
    expect(passwordSchema.safeParse('CorrectHorse9').success).toBe(true)
  })

  it.each([
    ['too short', 'Ab3xyz'],
    ['no uppercase', 'correcthorse9'],
    ['no lowercase', 'CORRECTHORSE9'],
    ['no digit', 'CorrectHorseXY'],
  ])('rejects a password with %s', (_label, password) => {
    expect(passwordSchema.safeParse(password).success).toBe(false)
  })

  it('rejects a password beyond the length limit', () => {
    expect(passwordSchema.safeParse(`Aa1${'x'.repeat(200)}`).success).toBe(false)
  })
})

describe('emailSchema and usernameSchema', () => {
  it('lowercases and trims an email address', () => {
    expect(emailSchema.parse('  USER@Example.com ')).toBe('user@example.com')
  })

  it.each(['plain', 'no@domain', 'a@b.c d', ''])('rejects %s as an email', (value) => {
    expect(emailSchema.safeParse(value).success).toBe(false)
  })

  it('rejects usernames with characters that could be abused in display', () => {
    expect(usernameSchema.safeParse('<script>').success).toBe(false)
    expect(usernameSchema.safeParse('member 01').success).toBe(false)
    expect(usernameSchema.safeParse('ok.name-1_2').success).toBe(true)
  })
})

describe('referralCodeSchema', () => {
  it('uppercases the code so lookups are case insensitive', () => {
    expect(referralCodeSchema.parse(' abc729 ')).toBe('ABC729')
  })
})

describe('amountSchema', () => {
  it('coerces numeric strings, including a comma decimal separator', () => {
    expect(amountSchema.parse('125.50')).toBe(125.5)
    expect(amountSchema.parse('125,50')).toBe(125.5)
    expect(amountSchema.parse(60)).toBe(60)
  })

  it.each([
    ['zero', '0'],
    ['negative', '-10'],
    ['not a number', 'abc'],
    ['empty', ''],
    ['beyond the ceiling', '1000000001'],
    ['too many decimals', '1.123456789'],
  ])('rejects %s', (_label, value) => {
    expect(amountSchema.safeParse(value).success).toBe(false)
  })
})

describe('vipWithdrawalFeeSchema', () => {
  const planId = '4abf39d3-2868-4f87-9b38-301557189288'

  it('accepts zero and positive fees up to eight decimal places', () => {
    expect(vipWithdrawalFeeSchema.parse({ planId, fee: '0.00000000' }).fee).toBe(0)
    expect(vipWithdrawalFeeSchema.parse({ planId, fee: '24' }).fee).toBe(24)
    expect(vipWithdrawalFeeSchema.parse({ planId, fee: '0.12345678' }).fee).toBe(0.12345678)
  })

  it.each(['', '-1', '0.123456789', '1000000001'])('rejects invalid VIP fees: %s', (fee) => {
    expect(vipWithdrawalFeeSchema.safeParse({ planId, fee }).success).toBe(false)
  })
})

describe('txHashSchema', () => {
  const evm = `0x${'a'.repeat(64)}`
  const tron = 'b'.repeat(64)

  it('accepts EVM and Tron hash formats', () => {
    expect(txHashSchema.parse(evm)).toBe(evm)
    expect(txHashSchema.parse(tron)).toBe(tron)
  })

  it.each([
    ['too short', '0xabc'],
    ['non-hex characters', `0x${'z'.repeat(64)}`],
    ['an injection attempt', "'; drop table deposits; --"],
  ])('rejects %s', (_label, value) => {
    expect(txHashSchema.safeParse(value).success).toBe(false)
  })
})

describe('walletAddressSchema', () => {
  it('accepts Tron and EVM addresses', () => {
    expect(walletAddressSchema.safeParse('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t').success).toBe(true)
    expect(walletAddressSchema.safeParse(`0x${'1'.repeat(40)}`).success).toBe(true)
  })

  it('rejects addresses containing punctuation or whitespace', () => {
    expect(walletAddressSchema.safeParse('TR7NHqje KQxGTCi8q8ZY4pL8otSzgjLj6t').success).toBe(false)
    expect(walletAddressSchema.safeParse('<img src=x onerror=alert(1)>').success).toBe(false)
  })

  it('rejects an address that is too short to be real', () => {
    expect(walletAddressSchema.safeParse('T123').success).toBe(false)
  })
})

describe('deposit and withdrawal request schemas', () => {
  it('normalises the network code to upper case', () => {
    const parsed = createDepositSchema.parse({ amount: '125', networkCode: 'trc20' })
    expect(parsed).toEqual({ amount: 125, networkCode: 'TRC20' })
  })

  it('rejects a withdrawal with a zero amount', () => {
    const result = requestWithdrawalSchema.safeParse({
      amount: '0',
      networkCode: 'TRC20',
      address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    })
    expect(result.success).toBe(false)
  })

  it('accepts a well-formed withdrawal request', () => {
    const result = requestWithdrawalSchema.safeParse({
      amount: '80',
      networkCode: 'TRC20',
      address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    })
    expect(result.success).toBe(true)
  })
})

describe('admin schemas', () => {
  it('requires a written reason on a balance adjustment', () => {
    const base = { userId: '00000000-0000-4000-8000-000000000000', amount: '-25' }
    expect(adjustBalanceSchema.safeParse({ ...base, reason: 'x' }).success).toBe(false)
    expect(adjustBalanceSchema.safeParse({ ...base, reason: 'Ticket 42 correction' }).success).toBe(true)
  })

  it('rejects a zero adjustment, which would post a meaningless ledger row', () => {
    const result = adjustBalanceSchema.safeParse({
      userId: '00000000-0000-4000-8000-000000000000',
      amount: '0',
      reason: 'Ticket 42 correction',
    })
    expect(result.success).toBe(false)
  })

  it('allows a negative adjustment', () => {
    const result = adjustBalanceSchema.safeParse({
      userId: '00000000-0000-4000-8000-000000000000',
      amount: '-25.5',
      reason: 'Ticket 42 correction',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.amount).toBe(-25.5)
  })

  it('requires a real transaction hash before a withdrawal can be marked paid', () => {
    const base = { withdrawalId: '00000000-0000-4000-8000-000000000000' }
    expect(markPaidSchema.safeParse({ ...base, txHash: 'paid' }).success).toBe(false)
    expect(markPaidSchema.safeParse({ ...base, txHash: `0x${'a'.repeat(64)}` }).success).toBe(true)
  })

  it('rejects a non-uuid identifier', () => {
    expect(markPaidSchema.safeParse({ withdrawalId: '42', txHash: `0x${'a'.repeat(64)}` }).success).toBe(false)
  })

  it('caps a VIP reward rate at 1', () => {
    const plan = {
      name: 'VIP 1',
      level: 1,
      activation_amount: '60',
      daily_task_limit: 3,
      reward_rate: '1.5',
      active: true,
    }
    expect(vipPlanSchema.safeParse(plan).success).toBe(false)
    expect(vipPlanSchema.safeParse({ ...plan, reward_rate: '0.03' }).success).toBe(true)
  })

  it('keeps the task timer inside sane bounds', () => {
    const task = {
      title: 'Property photo verification',
      description: 'Check that the listing photos match the property description.',
      task_type: 'PHOTO_VERIFICATION',
      duration_seconds: 5,
      difficulty: 'EASY',
      active: true,
    }
    expect(taskSchema.safeParse(task).success).toBe(false)
    expect(taskSchema.safeParse({ ...task, duration_seconds: 180 }).success).toBe(true)
  })

  it('requires UPPER_SNAKE_CASE task types', () => {
    const task = {
      title: 'Property photo verification',
      description: 'Check that the listing photos match the property description.',
      task_type: 'photo verification',
      duration_seconds: 180,
    }
    expect(taskSchema.safeParse(task).success).toBe(false)
  })

  it('treats an empty fixed reward as "derive from the VIP plan"', () => {
    const result = taskSchema.safeParse({
      title: 'Property photo verification',
      description: 'Check that the listing photos match the property description.',
      task_type: 'PHOTO_VERIFICATION',
      reward_amount: '',
      duration_seconds: 180,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.reward_amount).toBeNull()
  })

  it('restricts setting keys to lower_snake_case', () => {
    expect(settingSchema.safeParse({ key: 'Withdrawal Cooldown', value: '10' }).success).toBe(false)
    expect(settingSchema.safeParse({ key: 'withdrawal_cooldown_days', value: '10' }).success).toBe(true)
  })
})

describe('loginSchema', () => {
  it('accepts credentials and an optional redirect target', () => {
    const result = loginSchema.safeParse({ email: 'a@b.co', password: 'anything', next: '/wallet' })
    expect(result.success).toBe(true)
  })

  it('requires a password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false)
  })
})

describe('fieldErrorsOf', () => {
  it('groups messages by field name', () => {
    const result = registerSchema.safeParse({ ...validRegistration, email: 'nope', password: 'short' })
    expect(result.success).toBe(false)
    if (result.success) return

    const errors = fieldErrorsOf(result.error)
    expect(Object.keys(errors)).toEqual(expect.arrayContaining(['email', 'password']))
    expect(errors.email?.length).toBeGreaterThan(0)
  })
})
