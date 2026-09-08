'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActionSession } from '@/lib/auth/session'
import { activateVipSchema, fieldErrorsOf } from '@/lib/validation/schemas'
import { actionError, actionOk, mapDbError, type ActionResult } from '@/lib/security/errors'
import { RATE_LIMITS, RATE_LIMIT_MESSAGE, guard } from '@/lib/security/rate-limit'

export interface ActivateVipResult {
  plan_id: string
  plan_name: string
  amount_charged: number
  daily_task_limit: number
}

/**
 * Activates or upgrades a VIP plan.
 *
 * The activation amount is read from the plan row inside the database
 * function, never from the form, and the charge is posted as a
 * VIP_ACTIVATION ledger entry against the user's available balance.
 * Rewards already claimed under a previous plan are untouched: the ledger
 * is append-only and past assignments keep their own `reward_amount`.
 */
export async function activateVipAction(
  _prev: ActionResult<ActivateVipResult> | null,
  formData: FormData,
): Promise<ActionResult<ActivateVipResult>> {
  const parsed = activateVipSchema.safeParse({ planId: formData.get('planId') })
  if (!parsed.success) {
    return actionError('Select a valid plan.', fieldErrorsOf(parsed.error))
  }

  const auth = await getActionSession()
  if (!auth.ok) return actionError(auth.error)

  if (!(await guard(RATE_LIMITS.vipActivate, auth.session.userId))) {
    return actionError(RATE_LIMIT_MESSAGE)
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('activate_vip', { p_plan_id: parsed.data.planId })

  if (error) return actionError(mapDbError(error))

  const result = data as ActivateVipResult
  revalidatePath('/vip')
  revalidatePath('/dashboard')
  revalidatePath('/tasks')
  revalidatePath('/wallet')

  return actionOk(result, `${result.plan_name} is now active.`)
}
