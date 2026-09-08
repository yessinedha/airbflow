'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActionSession } from '@/lib/auth/session'
import { createDepositSchema, submitDepositTxSchema, uuidSchema, fieldErrorsOf } from '@/lib/validation/schemas'
import { actionError, actionOk, mapDbError, type ActionResult } from '@/lib/security/errors'
import { RATE_LIMITS, RATE_LIMIT_MESSAGE, guard } from '@/lib/security/rate-limit'
import { verifyAndSettleDeposit, type VerificationReport } from '@/lib/blockchain/verification/verify-deposit'
import type { Deposit } from '@/types/database'

/**
 * Creates a deposit intent and returns the address to send to.
 *
 * Nothing is credited here. The amount the user types is a declaration
 * that helps them track their own transfer; the balance that eventually
 * appears comes from the verified on-chain amount.
 */
export async function createDepositIntentAction(
  _prev: ActionResult<Deposit> | null,
  formData: FormData,
): Promise<ActionResult<Deposit>> {
  const parsed = createDepositSchema.safeParse({
    amount: formData.get('amount'),
    networkCode: formData.get('networkCode'),
  })
  if (!parsed.success) {
    return actionError('Please correct the highlighted fields.', fieldErrorsOf(parsed.error))
  }

  const auth = await getActionSession()
  if (!auth.ok) return actionError(auth.error)

  if (!(await guard(RATE_LIMITS.deposit, auth.session.userId))) {
    return actionError(RATE_LIMIT_MESSAGE)
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('create_deposit_intent', {
    p_amount: parsed.data.amount,
    p_network_code: parsed.data.networkCode,
  })

  if (error) return actionError(mapDbError(error))

  revalidatePath('/deposit')
  return actionOk(data as Deposit, 'Deposit instructions created. Send the funds, then submit your transaction hash.')
}

/**
 * Attaches the transaction hash and immediately attempts verification.
 *
 * If the transaction is real but still shallow, the deposit stays PENDING
 * and the scheduled job settles it once it has enough confirmations.
 */
export async function submitDepositTxAction(
  _prev: ActionResult<VerificationReport> | null,
  formData: FormData,
): Promise<ActionResult<VerificationReport>> {
  const parsed = submitDepositTxSchema.safeParse({
    depositId: formData.get('depositId'),
    txHash: formData.get('txHash'),
  })
  if (!parsed.success) {
    return actionError('Please correct the highlighted fields.', fieldErrorsOf(parsed.error))
  }

  const auth = await getActionSession()
  if (!auth.ok) return actionError(auth.error)

  if (!(await guard(RATE_LIMITS.depositVerify, auth.session.userId))) {
    return actionError(RATE_LIMIT_MESSAGE)
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('attach_deposit_tx', {
    p_deposit_id: parsed.data.depositId,
    p_tx_hash: parsed.data.txHash,
  })
  if (error) return actionError(mapDbError(error))

  const report = await verifyAndSettleDeposit(parsed.data.depositId)

  revalidatePath('/deposit')
  revalidatePath('/wallet')
  revalidatePath('/dashboard')

  return actionOk(report, describeReport(report))
}

/** Manual re-check button for a deposit that is waiting on confirmations. */
export async function recheckDepositAction(
  _prev: ActionResult<VerificationReport> | null,
  formData: FormData,
): Promise<ActionResult<VerificationReport>> {
  const parsed = uuidSchema.safeParse(formData.get('depositId'))
  if (!parsed.success) return actionError('Invalid deposit.')

  const auth = await getActionSession()
  if (!auth.ok) return actionError(auth.error)

  if (!(await guard(RATE_LIMITS.depositVerify, auth.session.userId))) {
    return actionError(RATE_LIMIT_MESSAGE)
  }

  // Ownership check before spending a provider call on someone else's row.
  const supabase = await createSupabaseServerClient()
  const { data: deposit } = await supabase
    .from('deposits')
    .select('id')
    .eq('id', parsed.data)
    .eq('user_id', auth.session.userId)
    .maybeSingle()

  if (!deposit) return actionError('Deposit not found.')

  const report = await verifyAndSettleDeposit(parsed.data)

  revalidatePath('/deposit')
  revalidatePath('/wallet')
  revalidatePath('/dashboard')

  return actionOk(report, describeReport(report))
}

function describeReport(report: VerificationReport): string {
  switch (report.outcome) {
    case 'CREDITED':
      return report.alreadyCredited
        ? 'This deposit was already credited.'
        : `Verified on chain. ${report.amount.toFixed(2)} USDT credited to your internal platform balance.`
    case 'PENDING':
      return `Transaction found. Waiting for confirmations (${report.confirmations}/${report.required}).`
    case 'REJECTED':
      return `Verification failed: ${report.reason}`
    case 'UNAVAILABLE':
      return `Could not verify right now: ${report.reason} Your deposit stays pending and will be retried.`
    default:
      return report.reason
  }
}
