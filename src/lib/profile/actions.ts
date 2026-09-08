'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getActionSession } from '@/lib/auth/session'
import { usernameSchema, passwordSchema, fieldErrorsOf } from '@/lib/validation/schemas'
import { actionError, actionOk, mapDbError, type ActionResult } from '@/lib/security/errors'

const updateUsernameSchema = z.object({ username: usernameSchema })

export async function updateUsernameAction(
  _prev: ActionResult<{ username: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ username: string }>> {
  const parsed = updateUsernameSchema.safeParse({ username: formData.get('username') })
  if (!parsed.success) {
    return actionError('Please correct the highlighted fields.', fieldErrorsOf(parsed.error))
  }

  const auth = await getActionSession()
  if (!auth.ok) return actionError(auth.error)

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('profiles')
    .update({ username: parsed.data.username })
    .eq('id', auth.session.userId)

  if (error) {
    if (error.message.includes('profiles_username_key') || error.message.includes('duplicate key')) {
      return actionError('That username is already taken.', { username: ['That username is already taken.'] })
    }
    return actionError(mapDbError(error))
  }

  revalidatePath('/profile')
  revalidatePath('/', 'layout')
  return actionOk({ username: parsed.data.username }, 'Username updated.')
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

/**
 * Changes the account password.
 *
 * The current password is re-verified first, so a hijacked but idle
 * session cannot silently take the account over.
 */
export async function changePasswordAction(
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  })
  if (!parsed.success) {
    return actionError('Please correct the highlighted fields.', fieldErrorsOf(parsed.error))
  }

  const auth = await getActionSession()
  if (!auth.ok) return actionError(auth.error)

  const supabase = await createSupabaseServerClient()

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: auth.session.email,
    password: parsed.data.currentPassword,
  })
  if (reauthError) {
    return actionError('Your current password is incorrect.', {
      currentPassword: ['Your current password is incorrect.'],
    })
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword })
  if (error) return actionError(error.message)

  revalidatePath('/profile')
  return actionOk(null, 'Password updated.')
}
