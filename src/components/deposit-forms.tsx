'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createDepositIntentAction, recheckDepositAction, submitDepositTxAction } from '@/lib/deposits/actions'
import { Alert, Button, Field, Input, Select } from '@/components/ui'
import { IconCopy } from '@/components/icons'
import { formatUsdt } from '@/lib/format'
import { useT } from '@/lib/i18n/client'

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
  const t = useT()
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
      <Alert tone="warning" title={t.deposit.form.unavailableTitle}>
        {t.deposit.form.unavailableBody}
      </Alert>
    )
  }

  return (
    <form action={action} className="space-y-4">
      {state && !state.ok ? (
        <Alert tone="negative" title={t.deposit.form.errorTitle}>
          {state.error}
        </Alert>
      ) : null}

      <Field label={t.deposit.form.currency}>
        <Input value="USDT" readOnly disabled />
      </Field>

      <Field
        label={t.deposit.form.network}
        htmlFor="networkCode"
        errors={state && !state.ok ? state.fieldErrors?.networkCode : undefined}
      >
        <Select id="networkCode" name="networkCode" value={selected} onChange={(e) => setSelected(e.target.value)} required>
          {networks.map((n) => (
            <option key={n.code} value={n.code} disabled={!n.depositEnabled || !n.hasAddress}>
              {n.name}
              {!n.hasAddress
                ? t.deposit.form.unavailableSuffix
                : !n.depositEnabled
                  ? t.deposit.form.disabledSuffix
                  : ''}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label={t.deposit.form.amount}
        htmlFor="amount"
        errors={state && !state.ok ? state.fieldErrors?.amount : undefined}
        hint={
          network
            ? t.deposit.form.amountHint(formatUsdt(network.minDeposit), network.requiredConfirmations)
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
        {pending ? t.deposit.form.creating : t.deposit.form.submit}
      </Button>

      <p className="text-xs text-ink-subtle">{t.deposit.form.note}</p>
    </form>
  )
}

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const t = useT()
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
      {copied ? t.common.copied : (label ?? t.common.copy)}
    </button>
  )
}

export function SubmitTxForm({ depositId }: { depositId: string }) {
  const t = useT()
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
        label={t.deposit.form.txHash}
        htmlFor={`txHash-${depositId}`}
        errors={state && !state.ok ? state.fieldErrors?.txHash : undefined}
        hint={t.deposit.form.txHashHint}
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
        {pending ? t.deposit.form.verifying : t.deposit.form.submitTx}
      </Button>
    </form>
  )
}

export function RecheckButton({ depositId }: { depositId: string }) {
  const t = useT()
  const router = useRouter()
  const [state, action, pending] = useActionState(recheckDepositAction, null)

  useEffect(() => {
    if (state?.ok) router.refresh()
  }, [state, router])

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="depositId" value={depositId} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? t.deposit.form.checking : t.deposit.form.recheck}
      </Button>
      {state ? (
        <p className={`text-xs ${state.ok ? 'text-ink-muted' : 'text-negative'}`}>
          {state.ok ? state.message : state.error}
        </p>
      ) : null}
    </form>
  )
}
