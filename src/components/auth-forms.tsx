'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect } from 'react'
import { loginAction, registerAction, resendConfirmationAction } from '@/lib/auth/actions'
import { Alert, Button, Field, Input } from '@/components/ui'
import { EMAIL_NOT_CONFIRMED_MESSAGE } from '@/lib/security/errors'
import { IconBell, IconCheck } from '@/components/icons'

/**
 * Offered wherever a confirmation link is the thing standing between the
 * user and their account, so an undelivered email is never a dead end.
 */
function ResendConfirmation({ email, compact = false }: { email: string; compact?: boolean }) {
  const [state, action, pending] = useActionState(resendConfirmationAction, null)

  if (state?.ok) {
    return <p className="text-sm text-positive">{state.message}</p>
  }

  return (
    <form action={action} className={compact ? 'flex flex-wrap items-center gap-2' : 'space-y-2'}>
      {email ? <input type="hidden" name="email" value={email} /> : null}

      {email ? null : (
        <Field label="Your email address" htmlFor="resend-email">
          <Input id="resend-email" name="email" type="email" autoComplete="email" required />
        </Field>
      )}

      <Button type="submit" variant="secondary" size={compact ? 'sm' : 'md'} disabled={pending}>
        {pending ? 'Sending…' : 'Resend the confirmation email'}
      </Button>

      {state && !state.ok ? <p className="text-xs text-negative">{state.error}</p> : null}
    </form>
  )
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(loginAction, null)

  useEffect(() => {
    if (state?.ok) {
      router.replace(state.data.next)
      router.refresh()
    }
  }, [state, router])

  return (
    <form action={action} className="space-y-4">
      {state && !state.ok ? (
        state.error === EMAIL_NOT_CONFIRMED_MESSAGE ? (
          <Alert tone="warning" title="Confirm your email address first">
            <p>{state.error}</p>
            <div className="mt-3">
              <ResendConfirmation email="" compact />
            </div>
          </Alert>
        ) : (
          <Alert tone="negative">{state.error}</Alert>
        )
      ) : null}

      <input type="hidden" name="next" value={next ?? ''} />

      <Field label="Email" htmlFor="email" errors={state && !state.ok ? state.fieldErrors?.email : undefined}>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </Field>

      <Field label="Password" htmlFor="password" errors={state && !state.ok ? state.fieldErrors?.password : undefined}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}

export function RegisterForm({ defaultRef }: { defaultRef: string }) {
  const [state, action, pending] = useActionState(registerAction, null)

  if (state?.ok) {
    // When confirmation is pending, sending the user to /login would only
    // fail. The email step is made the obvious next action instead.
    if (state.data.needsEmailConfirmation) {
      return (
        <div className="space-y-4">
          <div className="rounded-card border border-warning/30 bg-warning-soft px-4 py-5 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-warning/20 text-warning">
              <IconBell width={22} height={22} />
            </span>
            <h2 className="mt-3 text-lg font-semibold tracking-tight">Confirm your email address</h2>
            <p className="mt-1.5 text-sm text-ink-muted">
              Your account was created, but it is not usable yet. We sent a confirmation link to
            </p>
            <p className="mt-1 break-all font-semibold">{state.data.email}</p>
          </div>

          <ol className="space-y-2 text-sm text-ink-muted">
            <li className="flex gap-2.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-ink">
                1
              </span>
              Open your inbox and find the message from us. Check the spam folder if it is not there.
            </li>
            <li className="flex gap-2.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-ink">
                2
              </span>
              Click the confirmation link.
            </li>
            <li className="flex gap-2.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-ink">
                3
              </span>
              Come back and sign in. Signing in before that will be refused.
            </li>
          </ol>

          <div className="border-t border-border pt-4">
            <p className="mb-2 text-sm text-ink-muted">Nothing arrived?</p>
            <ResendConfirmation email={state.data.email} />
          </div>

          <Link href="/login" className="block text-center text-sm text-brand hover:underline">
            I have confirmed my email, take me to sign in
          </Link>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <Alert tone="positive" title="Account created">
          <span className="inline-flex items-center gap-1.5">
            <IconCheck width={14} height={14} />
            {state.message}
          </span>
        </Alert>
        <Link href="/login" className="block">
          <Button className="w-full">Go to sign in</Button>
        </Link>
      </div>
    )
  }

  const errors = state && !state.ok ? state.fieldErrors : undefined

  return (
    <form action={action} className="space-y-4">
      {state && !state.ok ? <Alert tone="negative">{state.error}</Alert> : null}

      <Field
        label="Invitation code"
        htmlFor="referralCode"
        errors={errors?.referralCode}
        hint="Registration is invitation-only. Ask the member who invited you for their code."
      >
        <Input
          id="referralCode"
          name="referralCode"
          defaultValue={defaultRef}
          placeholder="ABC123"
          className="font-mono uppercase tracking-widest"
          maxLength={12}
          required
          readOnly={Boolean(defaultRef)}
        />
      </Field>

      <Field label="Email" htmlFor="email" errors={errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Field label="Username" htmlFor="username" errors={errors?.username} hint="3 to 24 characters.">
        <Input id="username" name="username" autoComplete="username" minLength={3} maxLength={24} required />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        errors={errors?.password}
        hint="At least 10 characters, with an uppercase letter, a lowercase letter and a number."
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>

      <Field label="Confirm password" htmlFor="confirmPassword" errors={errors?.confirmPassword}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>

      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" name="acceptTerms" value="on" required className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
        <span className="text-ink-muted">
          I have read and accept the{' '}
          <Link href="/terms" className="text-brand hover:underline">
            terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-brand hover:underline">
            privacy policy
          </Link>
          , and I understand that my dashboard balance is an internal platform ledger balance, not an on-chain wallet.
        </span>
      </label>
      {errors?.acceptTerms ? <p className="text-xs text-negative">{errors.acceptTerms[0]}</p> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  )
}
