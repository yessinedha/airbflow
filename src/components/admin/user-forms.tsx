'use client'

import { useActionState, useState } from 'react'
import {
  adjustBalanceAction,
  createAdminUserAction,
  deleteUserAction,
  setUserRoleAction,
  setUserStatusAction,
  updateUserUsernameAction,
} from '@/lib/admin/actions'
import { Field, Input, Select, Textarea } from '@/components/ui'
import { ActionFeedback, Disclosure, SubmitButton, useRefreshOnSuccess } from '@/components/admin/base'
import { formatUsdt } from '@/lib/format'
import type { UserRole, UserStatus } from '@/types/database'

export function CreateAdminUserForm() {
  const [state, action, pending] = useActionState(createAdminUserAction, null)
  useRefreshOnSuccess(state)

  return (
    <form action={action} className="space-y-3">
      <ActionFeedback state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Email" htmlFor="admin-user-email" errors={state && !state.ok ? state.fieldErrors?.email : undefined}>
          <Input id="admin-user-email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field
          label="Username"
          htmlFor="admin-user-username"
          errors={state && !state.ok ? state.fieldErrors?.username : undefined}
        >
          <Input id="admin-user-username" name="username" autoComplete="off" minLength={3} maxLength={24} required />
        </Field>
        <Field
          label="Inviter code"
          htmlFor="admin-user-referral-code"
          errors={state && !state.ok ? state.fieldErrors?.referralCode : undefined}
        >
          <Input id="admin-user-referral-code" name="referralCode" autoComplete="off" minLength={6} maxLength={12} required />
        </Field>
      </div>
      <p className="text-xs text-ink-subtle">The user receives an invitation email and is added under this inviter.</p>
      <SubmitButton pending={pending} size="sm" pendingLabel="Sending invitation…">
        Invite user
      </SubmitButton>
    </form>
  )
}

export function UpdateUserUsernameForm({ userId, current }: { userId: string; current: string | null }) {
  const [state, action, pending] = useActionState(updateUserUsernameAction, null)
  useRefreshOnSuccess(state)

  return (
    <Disclosure label="Edit username">
      <form action={action} className="space-y-3">
        <ActionFeedback state={state} />
        <input type="hidden" name="userId" value={userId} />
        <Field
          label="Username"
          htmlFor={`username-${userId}`}
          errors={state && !state.ok ? state.fieldErrors?.username : undefined}
        >
          <Input
            id={`username-${userId}`}
            name="username"
            defaultValue={current ?? ''}
            minLength={3}
            maxLength={24}
            required
          />
        </Field>
        <SubmitButton pending={pending} size="sm" pendingLabel="Saving…">
          Save username
        </SubmitButton>
      </form>
    </Disclosure>
  )
}

/**
 * Posts an ADMIN_ADJUSTMENT ledger entry. There is no way to change a
 * balance without one, so this form is the only manual lever an operator
 * has over a user's funds.
 *
 * The page keys this component on the user's balance, so a successful
 * adjustment remounts it with an empty field: an operator cannot resubmit
 * the same amount by accident.
 */
export function AdjustBalanceForm({ userId, currentBalance }: { userId: string; currentBalance: string }) {
  const [state, action, pending] = useActionState(adjustBalanceAction, null)
  const [amount, setAmount] = useState('')
  useRefreshOnSuccess(state)

  const parsed = Number(amount.replace(',', '.'))
  const projected = Number.isFinite(parsed) ? Number(currentBalance) + parsed : null

  return (
    <Disclosure label="Adjust balance">
      <form action={action} className="space-y-3">
        <ActionFeedback state={state} />
        <input type="hidden" name="userId" value={userId} />

        <Field
          label="Amount (USDT)"
          htmlFor={`adj-${userId}`}
          errors={state && !state.ok ? state.fieldErrors?.amount : undefined}
          hint="Positive credits the user, negative debits them. A matching ledger entry is always written."
        >
          <Input
            id={`adj-${userId}`}
            name="amount"
            type="number"
            step="0.00000001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="-25.00"
            required
          />
        </Field>

        {projected !== null && amount !== '' ? (
          <p className={`text-xs ${projected < 0 ? 'text-negative' : 'text-ink-muted'}`}>
            New available balance would be {formatUsdt(projected)}
            {projected < 0 ? ' — this will be rejected, balances cannot go negative.' : '.'}
          </p>
        ) : null}

        <Field
          label="Reason"
          htmlFor={`adjr-${userId}`}
          errors={state && !state.ok ? state.fieldErrors?.reason : undefined}
        >
          <Textarea
            id={`adjr-${userId}`}
            name="reason"
            required
            minLength={5}
            maxLength={500}
            placeholder="Ticket reference and what is being corrected."
          />
        </Field>

        <SubmitButton pending={pending} size="sm" pendingLabel="Posting…">
          Post adjustment
        </SubmitButton>
      </form>
    </Disclosure>
  )
}

export function SetUserStatusForm({ userId, current }: { userId: string; current: UserStatus }) {
  const [state, action, pending] = useActionState(setUserStatusAction, null)
  useRefreshOnSuccess(state)

  return (
    <Disclosure label="Change account status">
      <form action={action} className="space-y-3">
        <ActionFeedback state={state} />
        <input type="hidden" name="userId" value={userId} />

        <Field label="Status" htmlFor={`status-${userId}`}>
          <Select id={`status-${userId}`} name="status" defaultValue={current} required>
            <option value="ACTIVE">ACTIVE — full access</option>
            <option value="SUSPENDED">SUSPENDED — cannot earn or withdraw</option>
            <option value="BANNED">BANNED — access revoked</option>
          </Select>
        </Field>

        <Field
          label="Reason (optional)"
          htmlFor={`sreason-${userId}`}
          errors={state && !state.ok ? state.fieldErrors?.reason : undefined}
        >
          <Input id={`sreason-${userId}`} name="reason" maxLength={500} />
        </Field>

        <SubmitButton pending={pending} size="sm" pendingLabel="Saving…">
          Save status
        </SubmitButton>
      </form>
    </Disclosure>
  )
}

/** Only rendered for SUPER_ADMIN; the action re-checks the role server-side. */
export function SetUserRoleForm({ userId, current }: { userId: string; current: UserRole }) {
  const [state, action, pending] = useActionState(setUserRoleAction, null)
  useRefreshOnSuccess(state)

  return (
    <Disclosure label="Change role" tone="danger">
      <form action={action} className="space-y-3">
        <ActionFeedback state={state} />
        <input type="hidden" name="userId" value={userId} />

        <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-ink">
          Administrators can move other people&apos;s money. Grant this only to accounts you control.
        </p>

        <Field label="Role" htmlFor={`role-${userId}`}>
          <Select id={`role-${userId}`} name="role" defaultValue={current} required>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
          </Select>
        </Field>

        <SubmitButton pending={pending} size="sm" variant="danger" pendingLabel="Saving…">
          Save role
        </SubmitButton>
      </form>
    </Disclosure>
  )
}

export function DeleteUserForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(deleteUserAction, null)

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm('Permanently delete this account and all of its data? This cannot be undone.')) {
          event.preventDefault()
        }
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="userId" value={userId} />
      <SubmitButton pending={pending} variant="danger" size="sm" pendingLabel="Deleting…">
        Delete account permanently
      </SubmitButton>
      {state && !state.ok ? <p className="text-xs text-negative">{state.error}</p> : null}
    </form>
  )
}
