import { z } from 'zod'

/**
 * Every server action parses its input with one of these schemas before
 * touching the database. Amounts are additionally re-validated inside the
 * PL/pgSQL functions, so a bypassed client is still harmless.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(5, 'Enter your email address')
  .max(254, 'Email address is too long')
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Enter a valid email address')
  .transform((v) => v.toLowerCase())

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((v) => /[a-z]/.test(v), 'Password must contain a lowercase letter')
  .refine((v) => /[A-Z]/.test(v), 'Password must contain an uppercase letter')
  .refine((v) => /\d/.test(v), 'Password must contain a number')

export const referralCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6,12}$/, 'Invitation code must be 6 to 12 letters or digits')

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(24, 'Username must be at most 24 characters')
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Username may only contain letters, digits, dot, dash and underscore')

/** Amounts arrive from HTML inputs as strings. */
export const amountSchema = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'))))
  .refine((v) => Number.isFinite(v), 'Enter a valid amount')
  .refine((v) => v > 0, 'Amount must be greater than zero')
  .refine((v) => v <= 1_000_000_000, 'Amount is too large')
  .refine((v) => Number(v.toFixed(8)) === v, 'Amount has too many decimal places')

export const networkCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{2,20}$/, 'Select a valid network')

export const txHashSchema = z
  .string()
  .trim()
  .min(10, 'Transaction hash is too short')
  .max(128, 'Transaction hash is too long')
  .regex(/^(0x)?[a-fA-F0-9]{40,128}$/, 'That does not look like a valid transaction hash')

export const walletAddressSchema = z
  .string()
  .trim()
  .min(20, 'Wallet address is too short')
  .max(128, 'Wallet address is too long')
  .regex(/^[a-zA-Z0-9]+$/, 'Wallet address contains invalid characters')

export const uuidSchema = z.string().uuid('Invalid identifier')

// ---------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------
export const registerSchema = z
  .object({
    email: emailSchema,
    username: usernameSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    referralCode: referralCodeSchema,
    // An unchecked box arrives as null (see auth/actions.ts), so the check
    // has to run on the raw value. Wrapping it in `.optional()` would make
    // Zod skip the refinement entirely for a missing box.
    acceptTerms: z
      .unknown()
      .refine((v) => v === true || v === 'on' || v === 'true', 'You must accept the terms to register')
      .transform(() => true),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128),
  next: z.string().optional(),
})

// ---------------------------------------------------------------------
// Tasks / VIP
// ---------------------------------------------------------------------
export const assignmentIdSchema = z.object({ assignmentId: uuidSchema })
export const activateVipSchema = z.object({ planId: uuidSchema })

// ---------------------------------------------------------------------
// Deposits
// ---------------------------------------------------------------------
export const createDepositSchema = z.object({
  amount: amountSchema,
  networkCode: networkCodeSchema,
})

export const submitDepositTxSchema = z.object({
  depositId: uuidSchema,
  txHash: txHashSchema,
})

export const submitDepositProofSchema = z.object({
  depositId: uuidSchema,
  ocrAmount: amountSchema,
  ocrNetwork: z.string().trim().min(2).max(32),
  ocrStatus: z.string().trim().min(2).max(40),
  ocrDate: z.string().trim().min(10).max(40),
  ocrAddressMatched: z.literal('true'),
  ocrText: z.string().trim().min(20).max(10_000),
})

// ---------------------------------------------------------------------
// Withdrawals
// ---------------------------------------------------------------------
export const requestWithdrawalSchema = z.object({
  amount: amountSchema,
  networkCode: networkCodeSchema,
  address: walletAddressSchema,
})

export const withdrawalIdSchema = z.object({ withdrawalId: uuidSchema })

// ---------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------
export const adminReasonSchema = z.string().trim().min(5, 'Provide a reason of at least 5 characters').max(500)

export const approveDepositProofSchema = z.object({
  depositId: uuidSchema,
  amount: amountSchema,
  reason: adminReasonSchema,
  verifiedReceipt: z.literal('on'),
})

export const markPaidSchema = z.object({
  withdrawalId: uuidSchema,
  txHash: txHashSchema,
  note: z.string().trim().max(500).optional(),
})

export const rejectWithdrawalSchema = z.object({
  withdrawalId: uuidSchema,
  reason: adminReasonSchema,
})

export const adjustBalanceSchema = z.object({
  userId: uuidSchema,
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'))))
    .refine((v) => Number.isFinite(v) && v !== 0, 'Enter a non-zero amount')
    .refine((v) => Math.abs(v) <= 1_000_000, 'Amount is out of range'),
  reason: adminReasonSchema,
})

export const setUserStatusSchema = z.object({
  userId: uuidSchema,
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']),
  reason: z.string().trim().max(500).optional(),
})

export const createAdminUserSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  referralCode: referralCodeSchema,
})

export const updateUserUsernameSchema = z.object({
  userId: uuidSchema,
  username: usernameSchema,
})

export const setVipReferralEligibilitySchema = z.object({
  planId: uuidSchema,
  enabled: z.preprocess((value) => value === 'true', z.boolean()),
})

export const vipWithdrawalFeeSchema = z.object({
  planId: uuidSchema,
  fee: z
    .union([z.string().trim().min(1).transform(Number), z.number()])
    .refine((value) => Number.isFinite(value) && value >= 0, 'Enter a valid non-negative fee')
    .refine((value) => value <= 1_000_000_000, 'Fee is too large')
    .refine((value) => Number(value.toFixed(8)) === value, 'Fee has too many decimal places'),
})

export const vipPlanSchema = z.object({
  id: uuidSchema.optional(),
  name: z.string().trim().min(2).max(50),
  level: z.coerce.number().int().min(1).max(99),
  activation_amount: amountSchema,
  daily_task_limit: z.coerce.number().int().min(1).max(20),
  reward_rate: z.coerce.number().min(0).max(1),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
  active: z.coerce.boolean().default(true),
})

export const taskSchema = z.object({
  id: uuidSchema.optional(),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(1000),
  task_type: z.string().trim().min(2).max(50).regex(/^[A-Z0-9_]+$/, 'Use UPPER_SNAKE_CASE'),
  reward_amount: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === null || v === '') return null
      const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
      return Number.isFinite(n) ? n : null
    })
    .refine((v) => v === null || v >= 0, 'Reward cannot be negative'),
  duration_seconds: z.coerce.number().int().min(30).max(86400).default(180),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('EASY'),
  // Mirrors chk_tasks_image_url in the database: an absolute https URL or a
  // site-relative path, never javascript: or data:.
  image_url: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v === undefined || v === '' ? null : v))
    .refine(
      (v) => v === null || /^https:\/\/\S{3,}$/.test(v) || /^\/\S*$/.test(v),
      'Use an https:// address or a path starting with /',
    ),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
  active: z.coerce.boolean().default(true),
})

/** Upload of a task illustration. The file itself is checked in the action. */
export const taskImageUploadSchema = z.object({
  taskId: uuidSchema,
})

export const networkSchema = z.object({
  id: uuidSchema.optional(),
  code: networkCodeSchema,
  name: z.string().trim().min(2).max(60),
  chain: z.string().trim().min(2).max(30),
  token_symbol: z.string().trim().min(2).max(12),
  token_contract: z.string().trim().min(10).max(80),
  token_decimals: z.coerce.number().int().min(0).max(36),
  required_confirmations: z.coerce.number().int().min(0).max(1000),
  address_regex: z.string().trim().min(1).max(200),
  explorer_tx_url: z.string().trim().max(200).optional().or(z.literal('')),
  min_deposit: z.coerce.number().min(0),
  min_withdrawal: z.coerce.number().min(0),
  withdrawal_fee: z.coerce.number().min(0),
  deposit_enabled: z.coerce.boolean().default(true),
  withdrawal_enabled: z.coerce.boolean().default(true),
  active: z.coerce.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
})

export const depositAddressSchema = z.object({
  networkId: uuidSchema,
  address: walletAddressSchema,
  label: z.string().trim().max(100).optional().or(z.literal('')),
})

export const settingSchema = z.object({
  key: z.string().trim().min(2).max(64).regex(/^[a-z0-9_]+$/, 'Use lower_snake_case'),
  value: z.string().trim().max(500),
})

export const manualConfirmDepositSchema = z.object({
  depositId: uuidSchema,
  amount: amountSchema,
  txHash: txHashSchema,
  reason: adminReasonSchema,
})

export const rejectDepositSchema = z.object({
  depositId: uuidSchema,
  reason: adminReasonSchema,
})

/** Turns a Zod error into the field-error map used by the forms. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form'
    ;(out[key] ??= []).push(issue.message)
  }
  return out
}
