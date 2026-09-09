'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { changePasswordAction, updateUsernameAction } from '@/lib/profile/actions'
import { Alert, Button, Field, Input } from '@/components/ui'
import { useT } from '@/lib/i18n/client'

export function UsernameForm({ current }: { current: string }) {
  const t = useT()
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
        label={t.profile.username}
        htmlFor="username"
        errors={state && !state.ok ? state.fieldErrors?.username : undefined}
        hint={t.profile.usernameHint}
      >
        <Input id="username" name="username" defaultValue={current} minLength={3} maxLength={24} required />
      </Field>

      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? t.profile.saving : t.profile.saveUsername}
      </Button>
    </form>
  )
}

export function ChangePasswordForm() {
  const t = useT()
  const [state, action, pending] = useActionState(changePasswordAction, null)

  return (
    <form action={action} className="space-y-3">
      {state ? (
        <Alert tone={state.ok ? 'positive' : 'negative'}>{state.ok ? state.message : state.error}</Alert>
      ) : null}

      <Field
        label={t.profile.currentPassword}
        htmlFor="currentPassword"
        errors={state && !state.ok ? state.fieldErrors?.currentPassword : undefined}
      >
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </Field>

      <Field
        label={t.profile.newPassword}
        htmlFor="newPassword"
        errors={state && !state.ok ? state.fieldErrors?.newPassword : undefined}
        hint={t.profile.passwordHint}
      >
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required />
      </Field>

      <Field
        label={t.profile.confirmNewPassword}
        htmlFor="confirmPassword"
        errors={state && !state.ok ? state.fieldErrors?.confirmPassword : undefined}
      >
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>

      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? t.profile.updating : t.profile.updatePassword}
      </Button>
    </form>
  )
}
