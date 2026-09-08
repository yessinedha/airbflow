'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { emailSchema, loginSchema, registerSchema, fieldErrorsOf } from '@/lib/validation/schemas'
import {
  EMAIL_NOT_CONFIRMED_MESSAGE,
  SERVICE_UNAVAILABLE_MESSAGE,
  actionError,
  actionOk,
  isEmailNotConfirmed,
  isTransportError,
  mapDbError,
  type ActionResult,
} from '@/lib/security/errors'
import { RATE_LIMITS, RATE_LIMIT_MESSAGE, guard } from '@/lib/security/rate-limit'
import { siteUrl } from '@/lib/env'

export interface RegisterResult {
  needsEmailConfirmation: boolean
  email: string
}

/**
 * Invitation-only registration.
 *
 * The invitation code is checked twice: once here for a helpful error, and
 * again inside the `handle_new_user` trigger, which runs in the same
 * transaction as the auth user insert. A forged or missing code therefore
 * cannot produce an account even if this action were bypassed entirely.
 */
export async function registerAction(
  _prev: ActionResult<RegisterResult> | null,
  formData: FormData,
): Promise<ActionResult<RegisterResult>> {
  const parsed = registerSchema.safeParse({
    email: formData.get('email'),
    username: formData.get('username'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    referralCode: formData.get('referralCode'),
    acceptTerms: formData.get('acceptTerms') ?? false,
  })

  if (!parsed.success) {
    return actionError('Please correct the highlighted fields.', fieldErrorsOf(parsed.error))
  }

  if (!(await guard(RATE_LIMITS.register))) {
    return actionError(RATE_LIMIT_MESSAGE)
  }

  const { email, username, password, referralCode } = parsed.data
  const supabase = await createSupabaseServerClient()

  const { data: codeValid, error: codeError } = await supabase.rpc('is_valid_invitation_code', {
    p_code: referralCode,
  })
  if (codeError) {
    if (isTransportError(codeError)) return actionError(SERVICE_UNAVAILABLE_MESSAGE)
    return actionError(mapDbError(codeError))
  }
  if (codeValid !== true) {
    return actionError('That invitation code is not valid.', {
      referralCode: ['That invitation code is not valid.'],
    })
  }

  // Username collisions surface as an opaque trigger failure otherwise.
  const admin = createSupabaseAdminClient()
  const { data: existingUsername } = await admin
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .maybeSingle()
  if (existingUsername) {
    return actionError('That username is already taken.', { username: ['That username is already taken.'] })
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback`,
      data: { referral_code: referralCode, username },
    },
  })

  if (error) {
    const message = error.message ?? ''
    if (isTransportError(error)) {
      console.error('[auth] sign-up transport failure', message)
      return actionError(SERVICE_UNAVAILABLE_MESSAGE)
    }
    if (/already registered|already exists/i.test(message)) {
      return actionError('An account with that email already exists.', { email: ['Email already registered'] })
    }
    if (/INVALID_INVITATION_CODE|INVITATION_CODE_REQUIRED/i.test(message)) {
      return actionError('That invitation code is not valid.', { referralCode: ['Invalid invitation code'] })
    }
    if (/Database error/i.test(message)) {
      return actionError('Registration could not be completed. Check your invitation code and try again.')
    }
    return actionError(message || 'Registration failed. Please try again.')
  }

  const needsEmailConfirmation = !data.session

  revalidatePath('/', 'layout')
  return actionOk(
    { needsEmailConfirmation, email },
    needsEmailConfirmation
      ? 'Account created. Check your inbox to confirm your email address before signing in.'
      : 'Account created.',
  )
}

/**
 * Re-sends the signup confirmation email.
 *
 * Answers identically whether or not the address is registered, so it cannot
 * be used to enumerate accounts, and is rate limited because it causes mail
 * to be sent.
 */
export async function resendConfirmationAction(
  _prev: ActionResult<{ sent: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ sent: boolean }>> {
  const parsed = emailSchema.safeParse(formData.get('email'))
  if (!parsed.success) {
    return actionError('Enter a valid email address.', { email: ['Enter a valid email address'] })
  }

  if (!(await guard(RATE_LIMITS.resendConfirmation, `resend:${parsed.data}`))) {
    return actionError(RATE_LIMIT_MESSAGE)
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: parsed.data,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
  })

  if (error && isTransportError(error)) {
    return actionError(SERVICE_UNAVAILABLE_MESSAGE)
  }
  if (error) {
    // Includes "already confirmed" and "not found": both are answered the
    // same way so neither reveals whether the address exists.
    console.error('[auth] resend confirmation failed', error.message)
  }

  return actionOk(
    { sent: true },
    'If that address needs confirming, a new link is on its way. Check your spam folder too.',
  )
}

export async function loginAction(
  _prev: ActionResult<{ next: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ next: string }>> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') ?? undefined,
  })

  if (!parsed.success) {
    return actionError('Please correct the highlighted fields.', fieldErrorsOf(parsed.error))
  }

  if (!(await guard(RATE_LIMITS.login, parsed.data.email))) {
    return actionError(RATE_LIMIT_MESSAGE)
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error || !data.user) {
    // An unreachable auth service is not a credential problem, and saying so
    // would send the user looking for a password that was never wrong.
    if (isTransportError(error)) {
      console.error('[auth] sign-in transport failure', error?.message)
      return actionError(SERVICE_UNAVAILABLE_MESSAGE)
    }
    // The password was right but the address was never confirmed. Saying
    // "invalid password" here leaves the owner permanently stuck.
    if (isEmailNotConfirmed(error)) {
      return actionError(EMAIL_NOT_CONFIRMED_MESSAGE)
    }
    // Deliberately identical for unknown email and wrong password, so this
    // cannot be used to discover which addresses are registered.
    return actionError('Invalid email or password.')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', data.user.id)
    .maybeSingle<{ status: string }>()

  if (profile && profile.status !== 'ACTIVE') {
    await supabase.auth.signOut()
    return actionError(
      profile.status === 'BANNED'
        ? 'This account has been closed. Contact support for details.'
        : 'This account is suspended. Contact support for details.',
    )
  }

  const next = parsed.data.next && parsed.data.next.startsWith('/') ? parsed.data.next : '/dashboard'
  revalidatePath('/', 'layout')
  return actionOk({ next })
}

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function requestPasswordResetAction(
  _prev: ActionResult<{ sent: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ sent: boolean }>> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return actionError('Enter a valid email address.', { email: ['Enter a valid email address'] })
  }
  if (!(await guard(RATE_LIMITS.login, `reset:${email}`))) {
    return actionError(RATE_LIMIT_MESSAGE)
  }

  const supabase = await createSupabaseServerClient()
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl()}/auth/callback?type=recovery` })

  // Always the same answer, so this cannot be used to enumerate accounts.
  return actionOk({ sent: true }, 'If that email is registered, a reset link is on its way.')
}
