'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getAdminActionSession } from '@/lib/auth/session'
import { siteUrl } from '@/lib/env'
import {
  adjustBalanceSchema,
  approveDepositProofSchema,
  createAdminUserSchema,
  depositAddressSchema,
  fieldErrorsOf,
  manualConfirmDepositSchema,
  markPaidSchema,
  networkSchema,
  rejectDepositSchema,
  rejectWithdrawalSchema,
  setUserStatusSchema,
  setVipReferralEligibilitySchema,
  settingSchema,
  taskImageUploadSchema,
  taskSchema,
  updateUserUsernameSchema,
  uuidSchema,
  vipWithdrawalFeeSchema,
  vipPlanSchema,
} from '@/lib/validation/schemas'
import { actionError, actionOk, mapDbError, type ActionResult } from '@/lib/security/errors'
import { RATE_LIMITS, RATE_LIMIT_MESSAGE, guard } from '@/lib/security/rate-limit'
import { verifyAndSettleDeposit, type VerificationReport } from '@/lib/blockchain/verification/verify-deposit'

/**
 * Every action here runs the same three-step guard:
 *   1. Next.js session says the caller is an admin
 *   2. rate limit
 *   3. the SQL function calls assert_admin() again, which is the check
 *      that actually matters, because it is enforced inside the database
 *
 * Step 1 exists only to produce a nicer error message than a raw 42501.
 */
async function adminGuard() {
  const auth = await getAdminActionSession()
  if (!auth.ok) return auth
  if (!(await guard(RATE_LIMITS.adminWrite, auth.session.userId))) {
    return { ok: false as const, error: RATE_LIMIT_MESSAGE }
  }
  return auth
}

function revalidateAdmin(...paths: string[]) {
  revalidatePath('/admin')
  for (const p of paths) revalidatePath(p)
}

// ---------------------------------------------------------------------
// Withdrawals
// ---------------------------------------------------------------------
export async function approveWithdrawalAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const parsed = uuidSchema.safeParse(formData.get('withdrawalId'))
  if (!parsed.success) return actionError('Invalid withdrawal.')

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('admin_start_withdrawal_processing', {
    p_withdrawal_id: parsed.data,
  })
  if (error) return actionError(mapDbError(error))

  revalidateAdmin('/admin/withdrawals')
  return actionOk(data, 'Withdrawal moved to processing. Send the payment from your external wallet, then record the hash.')
}

export async function markWithdrawalPaidAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const parsed = markPaidSchema.safeParse({
    withdrawalId: formData.get('withdrawalId'),
    txHash: formData.get('txHash'),
    note: formData.get('note') || undefined,
  })
  if (!parsed.success) {
    return actionError('Please correct the highlighted fields.', fieldErrorsOf(parsed.error))
  }

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('admin_mark_withdrawal_paid', {
    p_withdrawal_id: parsed.data.withdrawalId,
    p_tx_hash: parsed.data.txHash ?? null,
    p_note: parsed.data.note ?? null,
  })
  if (error) return actionError(mapDbError(error))

  revalidateAdmin('/admin/withdrawals', '/admin/ledger')
  return actionOk(data, parsed.data.txHash
    ? 'Withdrawal marked as paid and the transaction hash is now visible to the user.'
    : 'Withdrawal marked as paid without a transaction hash.')
}

export async function rejectWithdrawalAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const parsed = rejectWithdrawalSchema.safeParse({
    withdrawalId: formData.get('withdrawalId'),
    reason: formData.get('reason'),
  })
  if (!parsed.success) {
    return actionError('Please correct the highlighted fields.', fieldErrorsOf(parsed.error))
  }

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('admin_reject_withdrawal', {
    p_withdrawal_id: parsed.data.withdrawalId,
    p_reason: parsed.data.reason,
  })
  if (error) return actionError(mapDbError(error))

  revalidateAdmin('/admin/withdrawals', '/admin/ledger')
  return actionOk(data, 'Withdrawal rejected and the locked funds were returned to the user.')
}

// ---------------------------------------------------------------------
// Deposits
// ---------------------------------------------------------------------
export async function adminRecheckDepositAction(
  _prev: ActionResult<VerificationReport> | null,
  formData: FormData,
): Promise<ActionResult<VerificationReport>> {
  const parsed = uuidSchema.safeParse(formData.get('depositId'))
  if (!parsed.success) return actionError('Invalid deposit.')

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)

  const report = await verifyAndSettleDeposit(parsed.data)
  revalidateAdmin('/admin/deposits')
  return actionOk(report, `Verification result: ${report.outcome}.`)
}

export async function adminConfirmDepositAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const parsed = manualConfirmDepositSchema.safeParse({
    depositId: formData.get('depositId'),
    amount: formData.get('amount'),
    txHash: formData.get('txHash'),
    reason: formData.get('reason'),
  })
  if (!parsed.success) {
    return actionError('Please correct the highlighted fields.', fieldErrorsOf(parsed.error))
  }

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('admin_confirm_deposit', {
    p_deposit_id: parsed.data.depositId,
    p_amount: parsed.data.amount,
    p_tx_hash: parsed.data.txHash,
    p_reason: parsed.data.reason,
  })
  if (error) return actionError(mapDbError(error))

  revalidateAdmin('/admin/deposits', '/admin/ledger')
  return actionOk(data, 'Deposit confirmed manually. The action is recorded in the audit log.')
}

export async function adminApproveDepositProofAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const parsed = approveDepositProofSchema.safeParse({
    depositId: formData.get('depositId'),
    amount: formData.get('amount'),
    reason: formData.get('reason'),
    verifiedReceipt: formData.get('verifiedReceipt'),
  })
  if (!parsed.success) {
    return actionError('Please verify the payment and correct the highlighted fields.', fieldErrorsOf(parsed.error))
  }

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('admin_approve_deposit_proof', {
    p_deposit_id: parsed.data.depositId,
    p_amount: parsed.data.amount,
    p_reason: parsed.data.reason,
  })
  if (error) return actionError(mapDbError(error))

  revalidateAdmin('/admin/deposits', '/admin/ledger')
  revalidatePath('/deposit')
  revalidatePath('/wallet')
  revalidatePath('/dashboard')
  return actionOk(data, 'Payment proof approved and the verified amount credited.')
}

export async function adminRejectDepositAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const parsed = rejectDepositSchema.safeParse({
    depositId: formData.get('depositId'),
    reason: formData.get('reason'),
  })
  if (!parsed.success) {
    return actionError('Please correct the highlighted fields.', fieldErrorsOf(parsed.error))
  }

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('admin_reject_deposit', {
    p_deposit_id: parsed.data.depositId,
    p_reason: parsed.data.reason,
  })
  if (error) return actionError(mapDbError(error))

  revalidateAdmin('/admin/deposits')
  return actionOk(data, 'Deposit rejected.')
}

// ---------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------
export async function createAdminUserAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const parsed = createAdminUserSchema.safeParse({
    email: formData.get('email'),
    username: formData.get('username'),
    referralCode: formData.get('referralCode'),
  })
  if (!parsed.success) {
    return actionError('Please correct the highlighted fields.', fieldErrorsOf(parsed.error))
  }

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)

  const supabase = await createSupabaseServerClient()
  const { data: validCode, error: codeError } = await supabase.rpc('is_valid_invitation_code', {
    p_code: parsed.data.referralCode,
  })
  if (codeError) return actionError(mapDbError(codeError))
  if (validCode !== true) {
    return actionError('That invitation code is not valid.', {
      referralCode: ['That invitation code is not valid.'],
    })
  }

  const { createSupabaseAdminClient } = await import('@/lib/supabase/admin')
  const admin = createSupabaseAdminClient()
  const { data: existingEmail, error: emailError } = await admin
    .from('profiles')
    .select('id')
    .eq('email', parsed.data.email)
    .maybeSingle()
  if (emailError) return actionError(mapDbError(emailError))
  if (existingEmail) return actionError('An account with that email already exists.', { email: ['Email already registered'] })

  const { data: existingUsername, error: usernameError } = await admin
    .from('profiles')
    .select('id')
    .eq('username', parsed.data.username)
    .maybeSingle()
  if (usernameError) return actionError(mapDbError(usernameError))
  if (existingUsername) {
    return actionError('That username is already taken.', { username: ['That username is already taken.'] })
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { username: parsed.data.username, referral_code: parsed.data.referralCode },
    redirectTo: `${siteUrl()}/auth/callback`,
  })
  if (error) return actionError(error.message || 'The invitation could not be sent.')

  if (data.user) {
    const { error: auditError } = await supabase.rpc('admin_log_user_invited', { p_user_id: data.user.id })
    if (auditError) console.error('[admin] user invitation audit failed', auditError.message)
  }

  revalidateAdmin('/admin/users')
  return actionOk(null, 'Invitation sent.')
}

export async function updateUserUsernameAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const parsed = updateUserUsernameSchema.safeParse({
    userId: formData.get('userId'),
    username: formData.get('username'),
  })
  if (!parsed.success) {
    return actionError('Please correct the highlighted fields.', fieldErrorsOf(parsed.error))
  }

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('admin_update_user_username', {
    p_user_id: parsed.data.userId,
    p_username: parsed.data.username,
  })
  if (error) return actionError(mapDbError(error))

  revalidateAdmin('/admin/users', `/admin/users/${parsed.data.userId}`)
  return actionOk(data, 'Username updated.')
}

export async function adjustBalanceAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const parsed = adjustBalanceSchema.safeParse({
    userId: formData.get('userId'),
    amount: formData.get('amount'),
    reason: formData.get('reason'),
  })
  if (!parsed.success) {
    return actionError('Please correct the highlighted fields.', fieldErrorsOf(parsed.error))
  }

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('admin_adjust_balance', {
    p_user_id: parsed.data.userId,
    p_amount: parsed.data.amount,
    p_reason: parsed.data.reason,
  })
  if (error) return actionError(mapDbError(error))

  revalidateAdmin('/admin/users', '/admin/ledger')
  return actionOk(data, 'Adjustment posted to the ledger.')
}

export async function setUserStatusAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const parsed = setUserStatusSchema.safeParse({
    userId: formData.get('userId'),
    status: formData.get('status'),
    reason: formData.get('reason') || undefined,
  })
  if (!parsed.success) {
    return actionError('Please correct the highlighted fields.', fieldErrorsOf(parsed.error))
  }

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('admin_set_user_status', {
    p_user_id: parsed.data.userId,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason ?? null,
  })
  if (error) return actionError(mapDbError(error))

  revalidateAdmin('/admin/users')
  return actionOk(data, `User status set to ${parsed.data.status}.`)
}

export async function setUserRoleAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const userId = uuidSchema.safeParse(formData.get('userId'))
  const role = formData.get('role')
  if (!userId.success || (role !== 'USER' && role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
    return actionError('Invalid role change request.')
  }

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)
  if (auth.session.profile.role !== 'SUPER_ADMIN') {
    return actionError('Only a super administrator can change roles.')
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('admin_set_user_role', {
    p_user_id: userId.data,
    p_role: role,
  })
  if (error) return actionError(mapDbError(error))

  revalidateAdmin('/admin/users')
  return actionOk(data, `Role set to ${role}.`)
}

export async function deleteUserAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const parsed = uuidSchema.safeParse(formData.get('userId'))
  if (!parsed.success) return actionError('Invalid user.')

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('admin_delete_user', { p_user_id: parsed.data })
  if (error) return actionError(mapDbError(error))

  revalidateAdmin('/admin/users', `/admin/users/${parsed.data}`)
  redirect('/admin/users')
}

// ---------------------------------------------------------------------
// VIP plans / tasks / networks: plain table writes, gated by RLS
// ---------------------------------------------------------------------
export async function saveVipPlanAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const parsed = vipPlanSchema.safeParse({
    id: formData.get('id') || undefined,
    name: formData.get('name'),
    level: formData.get('level'),
    activation_amount: formData.get('activation_amount'),
    daily_task_limit: formData.get('daily_task_limit'),
    reward_rate: formData.get('reward_rate'),
    description: formData.get('description') ?? '',
    sort_order: formData.get('sort_order') ?? 0,
    active: formData.get('active') === 'on' || formData.get('active') === 'true',
  })
  if (!parsed.success) {
    return actionError('Please correct the highlighted fields.', fieldErrorsOf(parsed.error))
  }

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)

  const { id, ...values } = parsed.data
  const supabase = await createSupabaseServerClient()
  const planValues = parsed.data.level > 7 ? { ...values, withdrawal_fee: 0 } : values

  const { error } = id
    ? await supabase.from('vip_plans').update(planValues).eq('id', id)
    : await supabase.from('vip_plans').insert(planValues)

  if (error) return actionError(mapDbError(error))

  revalidateAdmin('/admin/vip', '/vip')
  return actionOk(null, id ? 'Plan updated.' : 'Plan created.')
}

export async function saveVipWithdrawalFeeAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const parsed = vipWithdrawalFeeSchema.safeParse({
    planId: formData.get('planId'),
    fee: formData.get('fee'),
  })
  if (!parsed.success) return actionError('Enter a valid VIP withdrawal fee.', fieldErrorsOf(parsed.error))

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)

  const supabase = await createSupabaseServerClient()
  const { data: plan, error: lookupError } = await supabase
    .from('vip_plans')
    .select('id, level')
    .eq('id', parsed.data.planId)
    .maybeSingle()
  if (lookupError) return actionError(mapDbError(lookupError))
  if (!plan) return actionError('VIP plan not found.')
  if (plan.level > 7 && parsed.data.fee !== 0) {
    return actionError('ArbiFlow withdrawal fees are free for VIP levels above 7.')
  }

  const { error } = await supabase
    .from('vip_plans')
    .update({ withdrawal_fee: parsed.data.fee })
    .eq('id', plan.id)
  if (error) return actionError(mapDbError(error))

  revalidateAdmin('/admin/settings', '/withdraw')
  return actionOk(null, 'VIP withdrawal fee saved.')
}

export async function setVipReferralEligibilityAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const parsed = setVipReferralEligibilitySchema.safeParse({
    planId: formData.get('planId'),
    enabled: formData.get('enabled'),
  })
  if (!parsed.success) return actionError('Invalid referral plan setting.', fieldErrorsOf(parsed.error))

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('admin_set_vip_referral_enabled', {
    p_plan_id: parsed.data.planId,
    p_enabled: parsed.data.enabled,
  })
  if (error) return actionError(mapDbError(error))

  revalidateAdmin('/admin/settings', '/admin/referrals')
  return actionOk(data, parsed.data.enabled ? 'VIP plan added to the referral programme.' : 'VIP plan removed from the referral programme.')
}

/** Image types the storage bucket accepts, mirrored from the migration. */
const TASK_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const
const TASK_IMAGE_MAX_BYTES = 2 * 1024 * 1024
const TASK_IMAGE_BUCKET = 'task-images'

const EXTENSION_FOR: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

/**
 * Uploads an illustration for one task and stores its public URL.
 *
 * The upload runs with the admin's own session, so the storage policies
 * added in migration 000700 are the check that actually enforces this —
 * the service-role key is never involved. The row update goes through the
 * same RLS path as any other admin write.
 *
 * The previous file is not deleted: a task's history may still reference
 * it, and storage is cheap. Remove old objects from the Supabase dashboard
 * if you need to reclaim space.
 */
export async function uploadTaskImageAction(
  _prev: ActionResult<{ image_url: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ image_url: string }>> {
  const parsed = taskImageUploadSchema.safeParse({ taskId: formData.get('taskId') })
  if (!parsed.success) return actionError('Invalid task.')

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return actionError('Choose an image first.')
  }
  if (!TASK_IMAGE_TYPES.includes(file.type as (typeof TASK_IMAGE_TYPES)[number])) {
    return actionError('Use a JPEG, PNG, WebP or AVIF image.')
  }
  if (file.size > TASK_IMAGE_MAX_BYTES) {
    return actionError('That image is larger than 2 MB. Compress it and try again.')
  }

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)

  const supabase = await createSupabaseServerClient()

  // A fresh name every time, so a replaced image is never served from a
  // stale CDN cache under the same URL.
  const extension = EXTENSION_FOR[file.type] ?? 'jpg'
  const objectPath = `${parsed.data.taskId}/${Date.now()}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from(TASK_IMAGE_BUCKET)
    .upload(objectPath, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('[uploadTaskImageAction] storage upload failed', uploadError)
    return actionError(describeStorageError(uploadError.message))
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(TASK_IMAGE_BUCKET).getPublicUrl(objectPath)

  const { error } = await supabase.from('tasks').update({ image_url: publicUrl }).eq('id', parsed.data.taskId)
  if (error) {
    // The upload itself worked, so a failure here is a schema or policy
    // problem the operator has to see verbatim — never a generic message.
    console.error('[uploadTaskImageAction] saving image_url failed', error)
    return actionError(describeTaskImageWriteError(error))
  }

  revalidateAdmin('/admin/tasks')
  revalidatePath('/tasks')
  return actionOk({ image_url: publicUrl }, 'Image uploaded.')
}

/**
 * Turns a Storage failure into something an operator can act on.
 *
 * These messages are deliberately specific. This surface is reachable only
 * by an admin, and hiding the cause behind "something went wrong" turns a
 * two-minute fix into an afternoon.
 */
function describeStorageError(raw: string): string {
  const message = raw.toLowerCase()

  if (message.includes('bucket') && message.includes('not found')) {
    return `Storage bucket "${TASK_IMAGE_BUCKET}" does not exist. Apply the migrations, or create a public bucket with that name in Supabase → Storage. You can paste an image URL in the meantime.`
  }
  if (message.includes('row-level security') || message.includes('unauthorized') || message.includes('403')) {
    return `Storage refused the write. The policies on storage.objects for "${TASK_IMAGE_BUCKET}" are missing — re-run migration 20260101000700, or add them in Supabase → Storage → Policies.`
  }
  if (message.includes('already exists') || message.includes('duplicate')) {
    return 'A file with that name already exists. Try the upload again.'
  }
  if (message.includes('payload') || message.includes('too large') || message.includes('413')) {
    return 'The storage bucket rejected the file as too large. Its limit is 2 MB.'
  }
  if (message.includes('mime') || message.includes('content type')) {
    return 'The storage bucket rejected this file type. Allowed: JPEG, PNG, WebP, AVIF.'
  }
  return `Upload failed: ${raw}`
}

/** Same idea for the row update that stores the resulting URL. */
function describeTaskImageWriteError(error: { code?: string; message: string }): string {
  const message = error.message.toLowerCase()

  // PostgREST caches the table schema. Right after the column is added it
  // still reports it as missing until told to reload.
  if (error.code === 'PGRST204' || (message.includes('schema cache') && message.includes('image_url'))) {
    return 'The image was uploaded, but the database API has not picked up the image_url column yet. Apply migration 20260101000800 (it sends the reload), or open Supabase → Settings → API → Reload schema, then upload again.'
  }
  if (message.includes('image_url') && message.includes('does not exist')) {
    return 'The image was uploaded, but the tasks.image_url column is missing. Run `npm run db:push` to apply the migrations, then try again.'
  }
  if (message.includes('chk_tasks_image_url')) {
    return 'The generated storage URL was rejected by the database check constraint, which only accepts https:// addresses. This happens with a Supabase instance served over plain http.'
  }
  return `The image was uploaded but could not be saved: ${error.message}`
}

/** Clears a task's illustration without touching the stored object. */
export async function clearTaskImageAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const parsed = uuidSchema.safeParse(formData.get('taskId'))
  if (!parsed.success) return actionError('Invalid task.')

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('tasks').update({ image_url: null }).eq('id', parsed.data)
  if (error) return actionError(mapDbError(error))

  revalidateAdmin('/admin/tasks')
  revalidatePath('/tasks')
  return actionOk(null, 'Image removed.')
}

export async function saveTaskAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const parsed = taskSchema.safeParse({
    id: formData.get('id') || undefined,
    title: formData.get('title'),
    description: formData.get('description'),
    task_type: formData.get('task_type'),
    reward_amount: formData.get('reward_amount') ?? '',
    duration_seconds: formData.get('duration_seconds') ?? 180,
    difficulty: formData.get('difficulty') ?? 'EASY',
    image_url: formData.get('image_url') ?? '',
    sort_order: formData.get('sort_order') ?? 0,
    active: formData.get('active') === 'on' || formData.get('active') === 'true',
  })
  if (!parsed.success) {
    return actionError('Please correct the highlighted fields.', fieldErrorsOf(parsed.error))
  }

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)

  const { id, ...values } = parsed.data
  const supabase = await createSupabaseServerClient()

  const { error } = id
    ? await supabase.from('tasks').update(values).eq('id', id)
    : await supabase.from('tasks').insert(values)

  if (error) return actionError(mapDbError(error))

  revalidateAdmin('/admin/tasks')
  revalidatePath('/tasks')
  return actionOk(null, id ? 'Task updated.' : 'Task created.')
}

export async function saveNetworkAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const parsed = networkSchema.safeParse({
    id: formData.get('id') || undefined,
    code: formData.get('code'),
    name: formData.get('name'),
    chain: formData.get('chain'),
    token_symbol: formData.get('token_symbol'),
    token_contract: formData.get('token_contract'),
    token_decimals: formData.get('token_decimals'),
    required_confirmations: formData.get('required_confirmations'),
    address_regex: formData.get('address_regex'),
    explorer_tx_url: formData.get('explorer_tx_url') ?? '',
    min_deposit: formData.get('min_deposit'),
    min_withdrawal: formData.get('min_withdrawal'),
    withdrawal_fee: formData.get('withdrawal_fee'),
    deposit_enabled: formData.get('deposit_enabled') === 'on' || formData.get('deposit_enabled') === 'true',
    withdrawal_enabled: formData.get('withdrawal_enabled') === 'on' || formData.get('withdrawal_enabled') === 'true',
    active: formData.get('active') === 'on' || formData.get('active') === 'true',
    sort_order: formData.get('sort_order') ?? 0,
  })
  if (!parsed.success) {
    return actionError('Please correct the highlighted fields.', fieldErrorsOf(parsed.error))
  }

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)

  const { id, ...values } = parsed.data
  const supabase = await createSupabaseServerClient()

  const { error } = id
    ? await supabase.from('supported_networks').update(values).eq('id', id)
    : await supabase.from('supported_networks').insert(values)

  if (error) return actionError(mapDbError(error))

  revalidateAdmin('/admin/settings', '/deposit', '/withdraw')
  return actionOk(null, id ? 'Network updated.' : 'Network created.')
}

export async function saveDepositAddressAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const parsed = depositAddressSchema.safeParse({
    networkId: formData.get('networkId'),
    address: formData.get('address'),
    label: formData.get('label') ?? '',
  })
  if (!parsed.success) {
    return actionError('Please correct the highlighted fields.', fieldErrorsOf(parsed.error))
  }

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)

  const supabase = await createSupabaseServerClient()

  // The address must match the network's own format rule, otherwise a typo
  // here would send every future depositor's funds nowhere.
  const { data: network } = await supabase
    .from('supported_networks')
    .select('address_regex, code')
    .eq('id', parsed.data.networkId)
    .maybeSingle<{ address_regex: string; code: string }>()

  if (!network) return actionError('Network not found.')

  try {
    if (!new RegExp(network.address_regex).test(parsed.data.address)) {
      return actionError(`That address does not match the expected format for ${network.code}.`, {
        address: ['Invalid address format for this network'],
      })
    }
  } catch {
    return actionError('The network address format rule is invalid. Fix it before adding addresses.')
  }

  const { error } = await supabase.from('deposit_addresses').insert({
    network_id: parsed.data.networkId,
    address: parsed.data.address,
    label: parsed.data.label || null,
  })

  if (error) return actionError(mapDbError(error))

  revalidateAdmin('/admin/settings', '/deposit')
  return actionOk(null, 'Deposit address added.')
}

export async function toggleDepositAddressAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const parsed = uuidSchema.safeParse(formData.get('addressId'))
  if (!parsed.success) return actionError('Invalid address.')

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)

  const supabase = await createSupabaseServerClient()
  const { data: current } = await supabase
    .from('deposit_addresses')
    .select('active')
    .eq('id', parsed.data)
    .maybeSingle<{ active: boolean }>()

  if (!current) return actionError('Address not found.')

  const { error } = await supabase
    .from('deposit_addresses')
    .update({ active: !current.active })
    .eq('id', parsed.data)

  if (error) return actionError(mapDbError(error))

  revalidateAdmin('/admin/settings', '/deposit')
  return actionOk(null, current.active ? 'Address disabled.' : 'Address enabled.')
}

// ---------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------
export async function saveSettingAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  const parsed = settingSchema.safeParse({
    key: formData.get('key'),
    value: formData.get('value'),
  })
  if (!parsed.success) {
    return actionError('Please correct the highlighted fields.', fieldErrorsOf(parsed.error))
  }

  if (
    parsed.data.key === 'withdrawal_task_lock_hours' &&
    (!/^\d+$/.test(parsed.data.value) || Number(parsed.data.value) > 720)
  ) {
    return actionError('Task lock duration must be a whole number of hours from 0 to 720.')
  }

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)

  // Numbers stay numbers and true/false stay booleans, so the stored jsonb
  // matches what seed.sql writes. Everything else is a JSON string.
  // `get_setting_text` reads all three shapes identically via `#>> '{}'`,
  // so this only keeps the table tidy — it changes no rule.
  const raw = parsed.data.value.trim()
  const jsonValue: unknown = /^-?\d+(\.\d+)?$/.test(raw)
    ? Number(raw)
    : raw === 'true'
      ? true
      : raw === 'false'
        ? false
        : raw

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('admin_set_setting', {
    p_key: parsed.data.key,
    p_value: jsonValue,
    p_description: null,
  })
  if (error) return actionError(mapDbError(error))

  revalidateAdmin('/admin/settings')
  revalidatePath('/', 'layout')
  return actionOk(data, 'Setting saved.')
}

// ---------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------
export async function broadcastNotificationAction(
  _prev: ActionResult<{ sent: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ sent: number }>> {
  const title = String(formData.get('title') ?? '').trim()
  const message = String(formData.get('message') ?? '').trim()
  const audience = String(formData.get('audience') ?? 'ALL')

  if (title.length < 3 || title.length > 120) return actionError('Title must be 3 to 120 characters.')
  if (message.length < 5 || message.length > 1000) return actionError('Message must be 5 to 1000 characters.')

  const auth = await adminGuard()
  if (!auth.ok) return actionError(auth.error)

  const { createSupabaseAdminClient } = await import('@/lib/supabase/admin')
  const admin = createSupabaseAdminClient()

  let query = admin.from('profiles').select('id').eq('status', 'ACTIVE')
  if (audience === 'VIP') query = query.not('current_vip_plan_id', 'is', null)
  if (audience === 'NON_VIP') query = query.is('current_vip_plan_id', null)

  const { data: users, error: usersError } = await query.returns<{ id: string }[]>()
  if (usersError) return actionError(mapDbError(usersError))

  const rows = (users ?? []).map((u) => ({
    user_id: u.id,
    title,
    message,
    type: 'INFO' as const,
    metadata: { broadcast: true, sent_by: auth.session.userId },
  }))

  if (rows.length === 0) return actionOk({ sent: 0 }, 'No users matched that audience.')

  // Chunked so a large user base does not exceed the request body limit.
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await admin.from('notifications').insert(rows.slice(i, i + CHUNK))
    if (error) return actionError(mapDbError(error))
  }

  await admin.rpc('log_admin_action', {
    p_admin_id: auth.session.userId,
    p_action: 'notification.broadcast',
    p_target_type: 'notification',
    p_target_id: null,
    p_payload: { title, audience, recipients: rows.length },
    p_ip: null,
    p_user_agent: null,
  })

  revalidateAdmin('/admin/notifications')
  return actionOk({ sent: rows.length }, `Notification sent to ${rows.length} user(s).`)
}
