'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActionSession } from '@/lib/auth/session'
import { assignmentIdSchema, fieldErrorsOf } from '@/lib/validation/schemas'
import { actionError, actionOk, mapDbError, type ActionResult } from '@/lib/security/errors'
import { RATE_LIMITS, RATE_LIMIT_MESSAGE, guard } from '@/lib/security/rate-limit'
import type { ClaimTaskResult, TaskAssignment } from '@/types/database'

/**
 * Starts a task. The authoritative `started_at` is written by Postgres with
 * `now()`, so the 180-second window is measured against server time and a
 * tampered client clock changes nothing.
 */
export async function startTaskAction(
  _prev: ActionResult<TaskAssignment> | null,
  formData: FormData,
): Promise<ActionResult<TaskAssignment>> {
  const parsed = assignmentIdSchema.safeParse({ assignmentId: formData.get('assignmentId') })
  if (!parsed.success) {
    return actionError('Invalid task.', fieldErrorsOf(parsed.error))
  }

  const auth = await getActionSession()
  if (!auth.ok) return actionError(auth.error)

  if (!(await guard(RATE_LIMITS.startTask, auth.session.userId))) {
    return actionError(RATE_LIMIT_MESSAGE)
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('start_task', { p_assignment_id: parsed.data.assignmentId })

  if (error) return actionError(mapDbError(error))

  revalidatePath('/tasks')
  return actionOk(data as TaskAssignment, 'Task started. The reward unlocks when the timer finishes.')
}

/**
 * Claims a task reward.
 *
 * No amount crosses the wire: `claim_task` recomputes the reward from the
 * user's active VIP plan, re-checks the elapsed time, the daily limit and
 * the assignment state, and writes the ledger entry atomically.
 */
export async function claimTaskAction(
  _prev: ActionResult<ClaimTaskResult> | null,
  formData: FormData,
): Promise<ActionResult<ClaimTaskResult>> {
  const parsed = assignmentIdSchema.safeParse({ assignmentId: formData.get('assignmentId') })
  if (!parsed.success) {
    return actionError('Invalid task.', fieldErrorsOf(parsed.error))
  }

  const auth = await getActionSession()
  if (!auth.ok) return actionError(auth.error)

  if (!(await guard(RATE_LIMITS.claimTask, auth.session.userId))) {
    return actionError(RATE_LIMIT_MESSAGE)
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('claim_task', { p_assignment_id: parsed.data.assignmentId })

  if (error) return actionError(mapDbError(error))

  const result = data as ClaimTaskResult
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  revalidatePath('/wallet')

  return actionOk(result, `Reward claimed: ${Number(result.reward_amount).toFixed(2)} USDT.`)
}

/** Assigns today's tasks if they do not exist yet. Idempotent. */
export async function refreshDailyTasksAction(): Promise<ActionResult<TaskAssignment[]>> {
  const auth = await getActionSession()
  if (!auth.ok) return actionError(auth.error)

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('ensure_daily_assignments')

  if (error) return actionError(mapDbError(error))

  revalidatePath('/tasks')
  return actionOk((data ?? []) as TaskAssignment[])
}
