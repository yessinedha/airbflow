'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createDepositIntentAction, recheckDepositAction, submitDepositTxAction } from '@/lib/deposits/actions'
import { Alert, Button, Field, Input, Select } from '@/components/ui'
import { IconCopy } from '@/components/icons'
import { formatUsdt } from '@/lib/format'

export interface NetworkOption {
  code: string
  name: string
  tokenSymbol: string
  minDeposit: number
  requiredConfirmations: number
  hasAddress: boolean
  depositEnabled: boolean
}

export function DepositIntentForm({ networks }: { networks: NetworkOption[] }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(createDepositIntentAction, null)
  const [selected, setSelected] = useState(networks[0]?.code ?? '')

  useEffect(() => {
    if (state?.ok) router.refresh()
  }, [state, router])

  const network = networks.find((n) => n.code === selected)
  const usable = networks.filter((n) => n.depositEnabled && n.hasAddress)

  if (usable.length === 0) {
    return (
      <Alert tone="warning" title="Deposits are not available yet">
        No deposit address has been configured for any network. Contact support before sending any funds.
      </Alert>
    )
  }

  return (
    <form action={action} className="space-y-4">
      {state && !state.ok ? (
        <Alert tone="negative" title="Could not create deposit instructions">
          {state.error}
        </Alert>
      ) : null}

      <Field label="Currency">
        <Input value="USDT" readOnly disabled />
      </Field>

      <Field label="Network" htmlFor="networkCode" errors={state && !state.ok ? state.fieldErrors?.networkCode : undefined}>
        <Select id="networkCode" name="networkCode" value={selected} onChange={(e) => setSelected(e.target.value)} required>
          {networks.map((n) => (
            <option key={n.code} value={n.code} disabled={!n.depositEnabled || !n.hasAddress}>
              {n.name}
              {!n.hasAddress ? ' — unavailable' : !n.depositEnabled ? ' — disabled' : ''}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Amount"
        htmlFor="amount"
        errors={state && !state.ok ? state.fieldErrors?.amount : undefined}
        hint={
          network
            ? `Minimum ${formatUsdt(network.minDeposit)}. ${network.requiredConfirmations} confirmations are required before crediting.`
            : undefined
        }
      >
        <Input
          id="amount"
          name="amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min={network?.minDeposit ?? 1}
          placeholder="125.00"
          required
        />
      </Field>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Creating…' : 'Get deposit instructions'}
      </Button>

      <p className="text-xs text-ink-subtle">
        The amount you enter is a note for your own tracking. Your balance is credited with the amount actually received
        on chain, which may differ if you send a different value.
      </p>
    </form>
  )
}

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1800)
        } catch {
          setCopied(false)
        }
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border-strong px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2"
    >
      <IconCopy />
      {copied ? 'Copied' : label}
    </button>
  )
}

export function SubmitTxForm({ depositId }: { depositId: string }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(submitDepositTxAction, null)

  useEffect(() => {
    if (state?.ok) router.refresh()
  }, [state, router])

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="depositId" value={depositId} />

      {state ? (
        <Alert tone={state.ok ? (state.data.outcome === 'CREDITED' ? 'positive' : 'info') : 'negative'}>
          {state.ok ? state.message : state.error}
        </Alert>
      ) : null}

      <Field
        label="Transaction hash"
        htmlFor={`txHash-${depositId}`}
        errors={state && !state.ok ? state.fieldErrors?.txHash : undefined}
        hint="Paste the hash from your wallet or from the block explorer after the transfer is broadcast."
      >
        <Input
          id={`txHash-${depositId}`}
          name="txHash"
          placeholder="0x… or Tron txID"
          autoComplete="off"
          spellCheck={false}
          className="font-mono text-xs"
          required
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Verifying on chain…' : 'Submit and verify'}
      </Button>
    </form>
  )
}

export function RecheckButton({ depositId }: { depositId: string }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(recheckDepositAction, null)

  useEffect(() => {
    if (state?.ok) router.refresh()
  }, [state, router])

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="depositId" value={depositId} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? 'Checking…' : 'Check status again'}
      </Button>
      {state ? (
        <p className={`text-xs ${state.ok ? 'text-ink-muted' : 'text-negative'}`}>
          {state.ok ? state.message : state.error}
        </p>
      ) : null}
    </form>
  )
}
