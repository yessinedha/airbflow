'use client'

import { useActionState, useState } from 'react'
import {
  adminApproveDepositProofAction,
  adminConfirmDepositAction,
  adminRecheckDepositAction,
  adminRejectDepositAction,
  approveWithdrawalAction,
  markWithdrawalPaidAction,
  rejectWithdrawalAction,
} from '@/lib/admin/actions'
import { Button, Field, Input, Textarea } from '@/components/ui'
import { ActionFeedback, Disclosure, SubmitButton, useRefreshOnSuccess } from '@/components/admin/base'

/* ------------------------------------------------------------------ */
/* Withdrawals                                                         */
/* ------------------------------------------------------------------ */

/** PENDING → PROCESSING. Signals that an operator has taken the request. */
export function ApproveWithdrawalButton({ withdrawalId }: { withdrawalId: string }) {
  const [state, action, pending] = useActionState(approveWithdrawalAction, null)
  useRefreshOnSuccess(state)

  return (
    <form action={action}>
      <input type="hidden" name="withdrawalId" value={withdrawalId} />
      <SubmitButton pending={pending} size="sm" pendingLabel="Approving…">
        Approve
      </SubmitButton>
      {state && !state.ok ? <p className="mt-1 text-xs text-negative">{state.error}</p> : null}
    </form>
  )
}

/**
 * Records the hash of a payment the operator already sent from an external
 * wallet. The platform never signs or broadcasts anything itself.
 */
export function MarkPaidForm({ withdrawalId, amount }: { withdrawalId: string; amount: string }) {
  const [state, action, pending] = useActionState(markWithdrawalPaidAction, null)
  useRefreshOnSuccess(state)

  return (
    <Disclosure label="Mark as paid" tone="success">
      <form action={action} className="space-y-3">
        <ActionFeedback state={state} />
        <input type="hidden" name="withdrawalId" value={withdrawalId} />

        <p className="rounded-lg bg-surface px-3 py-2 text-xs text-ink-muted">
          Send {amount} from the external payout wallet first, wait for the transaction to appear on chain, then paste
          its hash here. This does not move any funds; it records what you already sent and makes the hash visible to
          the user.
        </p>

        <Field
          label="Transaction hash"
          htmlFor={`txHash-${withdrawalId}`}
          errors={state && !state.ok ? state.fieldErrors?.txHash : undefined}
        >
          <Input
            id={`txHash-${withdrawalId}`}
            name="txHash"
            required
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-xs"
            placeholder="0x… or Tron hash"
          />
        </Field>

        <Field
          label="Internal note (optional)"
          htmlFor={`note-${withdrawalId}`}
          errors={state && !state.ok ? state.fieldErrors?.note : undefined}
        >
          <Input id={`note-${withdrawalId}`} name="note" maxLength={500} placeholder="Reference, batch, wallet used…" />
        </Field>

        <SubmitButton pending={pending} variant="success" size="sm" pendingLabel="Recording…">
          Record payment
        </SubmitButton>
      </form>
    </Disclosure>
  )
}

export function RejectWithdrawalForm({ withdrawalId }: { withdrawalId: string }) {
  const [state, action, pending] = useActionState(rejectWithdrawalAction, null)
  useRefreshOnSuccess(state)

  return (
    <Disclosure label="Reject" tone="danger">
      <form action={action} className="space-y-3">
        <ActionFeedback state={state} />
        <input type="hidden" name="withdrawalId" value={withdrawalId} />

        <Field
          label="Reason shown to the user"
          htmlFor={`reason-w-${withdrawalId}`}
          errors={state && !state.ok ? state.fieldErrors?.reason : undefined}
          hint="Rejecting releases the locked amount back to the user's available balance."
        >
          <Textarea id={`reason-w-${withdrawalId}`} name="reason" required minLength={5} maxLength={500} />
        </Field>

        <SubmitButton pending={pending} variant="danger" size="sm" pendingLabel="Rejecting…">
          Reject and release funds
        </SubmitButton>
      </form>
    </Disclosure>
  )
}

/* ------------------------------------------------------------------ */
/* Deposits                                                            */
/* ------------------------------------------------------------------ */

export function RecheckDepositButton({ depositId }: { depositId: string }) {
  const [state, action, pending] = useActionState(adminRecheckDepositAction, null)
  useRefreshOnSuccess(state)

  return (
    <form action={action}>
      <input type="hidden" name="depositId" value={depositId} />
      <SubmitButton pending={pending} size="sm" variant="secondary" pendingLabel="Checking…">
        Re-check chain
      </SubmitButton>
      {state ? (
        <p className={`mt-1 text-xs ${state.ok ? 'text-ink-muted' : 'text-negative'}`}>
          {state.ok ? state.message : state.error}
        </p>
      ) : null}
    </form>
  )
}

export function ApproveDepositProofForm({ depositId, declaredAmount }: { depositId: string; declaredAmount: string }) {
  const [state, action, pending] = useActionState(adminApproveDepositProofAction, null)
  const [verified, setVerified] = useState(false)
  useRefreshOnSuccess(state)

  return (
    <Disclosure label="Review proof and approve" tone="success">
      <form action={action} className="space-y-3">
        <ActionFeedback state={state} />
        <input type="hidden" name="depositId" value={depositId} />

        <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-ink">
          OCR is untrusted and does not verify a blockchain transfer. Check the private screenshot against the actual
          funds received at the platform wallet. Only the amount entered here is credited.
        </p>

        <Field
          label="Amount verified at the receiving wallet (USDT)"
          htmlFor={`proof-amount-${depositId}`}
          errors={state && !state.ok ? state.fieldErrors?.amount : undefined}
          hint={`The user declared ${declaredAmount} USDT. Enter the amount you independently verified.`}
        >
          <Input
            id={`proof-amount-${depositId}`}
            name="amount"
            type="number"
            step="0.00000001"
            min="0.00000001"
            required
            defaultValue={declaredAmount}
          />
        </Field>

        <Field
          label="Review note"
          htmlFor={`proof-reason-${depositId}`}
          errors={state && !state.ok ? state.fieldErrors?.reason : undefined}
        >
          <Textarea
            id={`proof-reason-${depositId}`}
            name="reason"
            required
            minLength={5}
            maxLength={500}
            placeholder="How you confirmed the received amount at the platform wallet."
          />
        </Field>

        <label className="flex items-start gap-2 text-xs text-ink-muted">
          <input
            type="checkbox"
            name="verifiedReceipt"
            value="on"
            checked={verified}
            onChange={(event) => setVerified(event.target.checked)}
            className="mt-0.5"
          />
          I independently verified that the funds reached the platform wallet.
        </label>

        <SubmitButton pending={pending} variant="success" size="sm" disabled={pending || !verified} pendingLabel="Approving…">
          Approve and credit verified amount
        </SubmitButton>
      </form>
    </Disclosure>
  )
}

/**
 * Exception path only. Normal deposits are credited by the on-chain
 * verifier; this exists for the cases it cannot handle (for example a
 * transfer sent to a retired address) and is fully audit-logged.
 */
export function ConfirmDepositForm({ depositId, declaredAmount }: { depositId: string; declaredAmount: string }) {
  const [state, action, pending] = useActionState(adminConfirmDepositAction, null)
  const [acknowledged, setAcknowledged] = useState(false)
  useRefreshOnSuccess(state)

  return (
    <Disclosure label="Manual override" tone="secondary">
      <form action={action} className="space-y-3">
        <ActionFeedback state={state} />
        <input type="hidden" name="depositId" value={depositId} />

        <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-ink">
          Manual confirmation bypasses on-chain verification and credits the internal ledger directly. Use it only after
          you have personally verified the transaction in a block explorer. The action is written to the audit log with
          your account.
        </p>

        <Field
          label="Verified amount (USDT)"
          htmlFor={`amount-${depositId}`}
          errors={state && !state.ok ? state.fieldErrors?.amount : undefined}
          hint={`User declared ${declaredAmount} USDT. Enter the amount you actually saw on chain.`}
        >
          <Input
            id={`amount-${depositId}`}
            name="amount"
            type="number"
            step="0.00000001"
            min="0.00000001"
            required
            defaultValue={declaredAmount}
          />
        </Field>

        <Field
          label="Transaction hash"
          htmlFor={`dtx-${depositId}`}
          errors={state && !state.ok ? state.fieldErrors?.txHash : undefined}
        >
          <Input id={`dtx-${depositId}`} name="txHash" required className="font-mono text-xs" spellCheck={false} />
        </Field>

        <Field
          label="Reason"
          htmlFor={`dreason-${depositId}`}
          errors={state && !state.ok ? state.fieldErrors?.reason : undefined}
        >
          <Textarea
            id={`dreason-${depositId}`}
            name="reason"
            required
            minLength={5}
            maxLength={500}
            placeholder="Why automatic verification could not be used, and how you verified it instead."
          />
        </Field>

        <label className="flex items-start gap-2 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5"
          />
          I have confirmed this transaction in a block explorer and it has not been credited before.
        </label>

        <SubmitButton pending={pending} size="sm" disabled={pending || !acknowledged} pendingLabel="Confirming…">
          Confirm deposit
        </SubmitButton>
      </form>
    </Disclosure>
  )
}

export function RejectDepositForm({ depositId }: { depositId: string }) {
  const [state, action, pending] = useActionState(adminRejectDepositAction, null)
  useRefreshOnSuccess(state)

  return (
    <Disclosure label="Reject" tone="danger">
      <form action={action} className="space-y-3">
        <ActionFeedback state={state} />
        <input type="hidden" name="depositId" value={depositId} />

        <Field
          label="Reason shown to the user"
          htmlFor={`dr-${depositId}`}
          errors={state && !state.ok ? state.fieldErrors?.reason : undefined}
        >
          <Textarea id={`dr-${depositId}`} name="reason" required minLength={5} maxLength={500} />
        </Field>

        <SubmitButton pending={pending} variant="danger" size="sm" pendingLabel="Rejecting…">
          Reject deposit
        </SubmitButton>
      </form>
    </Disclosure>
  )
}

/** Copies a payout address so the operator does not retype it. */
export function CopyValue({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <Button
      size="sm"
      variant="ghost"
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          setCopied(false)
        }
      }}
    >
      {copied ? 'Copied' : label}
    </Button>
  )
}
