'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect } from 'react'
import { loginAction, registerAction, resendConfirmationAction } from '@/lib/auth/actions'
import { Alert, Button, Field, Input } from '@/components/ui'
import { EMAIL_NOT_CONFIRMED_MESSAGE } from '@/lib/security/errors'
import { IconBell, IconCheck } from '@/components/icons'
import { useT } from '@/lib/i18n/client'

/**
 * Offered wherever a confirmation link is the thing standing between the
 * user and their account, so an undelivered email is never a dead end.
 */
function ResendConfirmation({ email, compact = false }: { email: string; compact?: boolean }) {
  const t = useT()
  const [state, action, pending] = useActionState(resendConfirmationAction, null)

  if (state?.ok) {
    return <p className="text-sm text-positive">{state.message}</p>
  }

  return (
    <form action={action} className={compact ? 'flex flex-wrap items-center gap-2' : 'space-y-2'}>
      {email ? <input type="hidden" name="email" value={email} /> : null}

      {email ? null : (
        <Field label={t.authForms.resendEmailLabel} htmlFor="resend-email">
          <Input id="resend-email" name="email" type="email" autoComplete="email" required />
        </Field>
      )}

      <Button type="submit" variant="secondary" size={compact ? 'sm' : 'md'} disabled={pending}>
        {pending ? t.authForms.resendSending : t.authForms.resendButton}
      </Button>

      {state && !state.ok ? <p className="text-xs text-negative">{state.error}</p> : null}
    </form>
  )
}

export function LoginForm({ next }: { next?: string }) {
  const t = useT()
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
        /* The server answers in English; the one case with a recovery path
           gets a translated explanation and the resend form. */
        state.error === EMAIL_NOT_CONFIRMED_MESSAGE ? (
          <Alert tone="warning" title={t.authForms.notConfirmedTitle}>
            <p>{t.authForms.notConfirmedBody}</p>
            <div className="mt-3">
              <ResendConfirmation email="" compact />
            </div>
          </Alert>
        ) : (
          <Alert tone="negative">{state.error}</Alert>
        )
      ) : null}

      <input type="hidden" name="next" value={next ?? ''} />

      <Field label={t.auth.email} htmlFor="email" errors={state && !state.ok ? state.fieldErrors?.email : undefined}>
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </Field>

      <Field
        label={t.auth.password}
        htmlFor="password"
        errors={state && !state.ok ? state.fieldErrors?.password : undefined}
      >
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t.auth.signingIn : t.auth.signInTitle}
      </Button>
    </form>
  )
}

export function RegisterForm({ defaultRef }: { defaultRef: string }) {
  const t = useT()
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
            <h2 className="display mt-3 text-lg font-semibold tracking-tight">{t.authForms.confirmTitle}</h2>
            <p className="mt-1.5 text-sm text-ink-muted">{t.authForms.confirmLead}</p>
            <p className="mt-1 break-all font-semibold" dir="ltr">
              {state.data.email}
            </p>
          </div>

          <ol className="space-y-2 text-sm text-ink-muted">
            <ConfirmStep n={1}>{t.authForms.confirmStep1}</ConfirmStep>
            <ConfirmStep n={2}>{t.authForms.confirmStep2}</ConfirmStep>
            <ConfirmStep n={3}>{t.authForms.confirmStep3}</ConfirmStep>
          </ol>

          <div className="border-t border-border pt-4">
            <p className="mb-2 text-sm text-ink-muted">{t.authForms.nothingArrived}</p>
            <ResendConfirmation email={state.data.email} />
          </div>

          <Link href="/login" className="block text-center text-sm text-brand hover:underline">
            {t.authForms.confirmedGoSignIn}
          </Link>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <Alert tone="positive" title={t.authForms.accountCreated}>
          <span className="inline-flex items-center gap-1.5">
            <IconCheck width={14} height={14} />
            {state.message}
          </span>
        </Alert>
        <Link href="/login" className="block">
          <Button className="w-full">{t.authForms.goToSignIn}</Button>
        </Link>
      </div>
    )
  }

  const errors = state && !state.ok ? state.fieldErrors : undefined

  return (
    <form action={action} className="space-y-4">
      {state && !state.ok ? <Alert tone="negative">{state.error}</Alert> : null}

      <Field
        label={t.auth.invitationCode}
        htmlFor="referralCode"
        errors={errors?.referralCode}
        hint={t.authForms.inviteHint}
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

      <Field label={t.auth.email} htmlFor="email" errors={errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Field label={t.auth.username} htmlFor="username" errors={errors?.username} hint={t.authForms.usernameHint}>
        <Input id="username" name="username" autoComplete="username" minLength={3} maxLength={24} required />
      </Field>

      <Field label={t.auth.password} htmlFor="password" errors={errors?.password} hint={t.authForms.passwordHint}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>

      <Field label={t.auth.confirmPassword} htmlFor="confirmPassword" errors={errors?.confirmPassword}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>

      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" name="acceptTerms" value="on" required className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
        <span className="text-ink-muted">
          {t.authForms.acceptBefore}
          <Link href="/terms" className="text-brand hover:underline">
            {t.authForms.acceptTerms}
          </Link>
          {t.authForms.acceptMiddle}
          <Link href="/privacy" className="text-brand hover:underline">
            {t.authForms.acceptPrivacy}
          </Link>
          {t.authForms.acceptAfter}
        </span>
      </label>
      {errors?.acceptTerms ? <p className="text-xs text-negative">{errors.acceptTerms[0]}</p> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t.auth.creatingAccount : t.auth.createAccount}
      </Button>
    </form>
  )
}

/** Numbered row in the "confirm your email" checklist. */
function ConfirmStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-ink">
        {n}
      </span>
      {children}
    </li>
  )
}
