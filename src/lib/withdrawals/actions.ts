'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActionSession } from '@/lib/auth/session'
import { requestWithdrawalSchema, withdrawalIdSchema, fieldErrorsOf } from '@/lib/validation/schemas'
import { actionError, actionOk, mapDbError, type ActionResult } from '@/lib/security/errors'
import { RATE_LIMITS, RATE_LIMIT_MESSAGE, guard } from '@/lib/security/rate-limit'

export interface WithdrawalRequestResult {
  withdrawal_id: string
  amount: number
  fee: number
  net_amount: number
  available_balance: number
  status: string
}

/**
 * Requests a withdrawal.
 *
 * `request_withdrawal` locks the profile row, re-evaluates the 30-day /
 * 10-day timing rules against server time, checks the balance, inserts the
 * request and posts the WITHDRAWAL_HOLD entry, all in one transaction.
 * Two concurrent requests cannot both pass: the second either fails the
 * balance check or trips the one-open-withdrawal unique index.
 */
export async function requestWithdrawalAction(
  _prev: ActionResult<WithdrawalRequestResult> | null,
  formData: FormData,
): Promise<ActionResult<WithdrawalRequestResult>> {
  const parsed = requestWithdrawalSchema.safeParse({
    amount: formData.get('amount'),
    networkCode: formData.get('networkCode'),
    address: formData.get('address'),
  })
  if (!parsed.success) {
    return actionError('Please correct the highlighted fields.', fieldErrorsOf(parsed.error))
  }

  const auth = await getActionSession()
  if (!auth.ok) return actionError(auth.error)

  if (!(await guard(RATE_LIMITS.withdrawal, auth.session.userId))) {
    return actionError(RATE_LIMIT_MESSAGE)
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('request_withdrawal', {
    p_amount: parsed.data.amount,
    p_network_code: parsed.data.networkCode,
    p_address: parsed.data.address,
  })

  if (error) return actionError(mapDbError(error))

  revalidatePath('/withdraw')
  revalidatePath('/wallet')
  revalidatePath('/dashboard')

  return actionOk(
    data as WithdrawalRequestResult,
    'Withdrawal requested. The amount is locked until the platform team settles it manually.',
  )
}

export async function cancelWithdrawalAction(
  _prev: ActionResult<{ withdrawal_id: string; status: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ withdrawal_id: string; status: string }>> {
  const parsed = withdrawalIdSchema.safeParse({ withdrawalId: formData.get('withdrawalId') })
  if (!parsed.success) return actionError('Invalid withdrawal.', fieldErrorsOf(parsed.error))

  const auth = await getActionSession()
  if (!auth.ok) return actionError(auth.error)

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('cancel_withdrawal', {
    p_withdrawal_id: parsed.data.withdrawalId,
  })

  if (error) return actionError(mapDbError(error))

  revalidatePath('/withdraw')
  revalidatePath('/wallet')
  revalidatePath('/dashboard')

  return actionOk(
    data as { withdrawal_id: string; status: string },
    'Withdrawal cancelled. The locked amount is back in your available balance.',
  )
}
