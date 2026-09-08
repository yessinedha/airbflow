'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { changePasswordAction, updateUsernameAction } from '@/lib/profile/actions'
import { Alert, Button, Field, Input } from '@/components/ui'

export function UsernameForm({ current }: { current: string }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(updateUsernameAction, null)

  useEffect(() => {
    if (state?.ok) router.refresh()
  }, [state, router])

  return (
    <form action={action} className="space-y-3">
      {state ? (
        <Alert tone={state.ok ? 'positive' : 'negative'}>{state.ok ? state.message : state.error}</Alert>
      ) : null}

      <Field
        label="Username"
        htmlFor="username"
        errors={state && !state.ok ? state.fieldErrors?.username : undefined}
        hint="Shown to your team members. 3 to 24 characters."
      >
        <Input id="username" name="username" defaultValue={current} minLength={3} maxLength={24} required />
      </Field>

      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Saving…' : 'Save username'}
      </Button>
    </form>
  )
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, null)

  return (
    <form action={action} className="space-y-3">
      {state ? (
        <Alert tone={state.ok ? 'positive' : 'negative'}>{state.ok ? state.message : state.error}</Alert>
      ) : null}

      <Field
        label="Current password"
        htmlFor="currentPassword"
        errors={state && !state.ok ? state.fieldErrors?.currentPassword : undefined}
      >
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </Field>

      <Field
        label="New password"
        htmlFor="newPassword"
        errors={state && !state.ok ? state.fieldErrors?.newPassword : undefined}
        hint="At least 10 characters, with an uppercase letter, a lowercase letter and a number."
      >
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required />
      </Field>

      <Field
        label="Confirm new password"
        htmlFor="confirmPassword"
        errors={state && !state.ok ? state.fieldErrors?.confirmPassword : undefined}
      >
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>

      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  )
}
