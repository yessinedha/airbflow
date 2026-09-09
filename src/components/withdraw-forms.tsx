'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cancelWithdrawalAction, requestWithdrawalAction } from '@/lib/withdrawals/actions'
import { Alert, Button, Field, Input, Select } from '@/components/ui'
import { formatUsdt } from '@/lib/format'
import { useT } from '@/lib/i18n/client'

export interface WithdrawNetworkOption {
  code: string
  name: string
  minWithdrawal: number
  fee: number
  enabled: boolean
  addressHint: string
}

export function WithdrawForm({
  networks,
  available,
  disabledReason,
}: {
  networks: WithdrawNetworkOption[]
  available: number
  disabledReason?: string | null
}) {
  const t = useT()
  const router = useRouter()
  const [state, action, pending] = useActionState(requestWithdrawalAction, null)
  const [code, setCode] = useState(networks.find((n) => n.enabled)?.code ?? networks[0]?.code ?? '')
  const [amount, setAmount] = useState('')

  // A successful request leaves the user with a pending withdrawal, so the
  // refreshed page replaces this form with the "already pending" notice.
  useEffect(() => {
    if (state?.ok) router.refresh()
  }, [state, router])

  const network = networks.find((n) => n.code === code)
  const numericAmount = Number(amount.replace(',', '.'))
  const net = useMemo(() => {
    if (!network || !Number.isFinite(numericAmount)) return null
    return numericAmount - network.fee
  }, [network, numericAmount])

  if (disabledReason) {
    return (
      <Alert tone="warning" title={t.withdraw.form.notAvailableTitle}>
        {disabledReason}
      </Alert>
    )
  }

  return (
    <form action={action} className="space-y-4">
      {state ? (
        <Alert
          tone={state.ok ? 'positive' : 'negative'}
          title={state.ok ? t.withdraw.form.requestReceived : t.withdraw.form.requestRejected}
        >
          {state.ok ? state.message : state.error}
        </Alert>
      ) : null}

      <Field
        label={t.withdraw.form.amount}
        htmlFor="amount"
        errors={state && !state.ok ? state.fieldErrors?.amount : undefined}
        hint={t.withdraw.form.amountHint(
          formatUsdt(available),
          network ? formatUsdt(network.minWithdrawal) : undefined,
          network ? formatUsdt(network.fee) : undefined,
        )}
      >
        <Input
          id="amount"
          name="amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min={network?.minWithdrawal ?? 1}
          max={available}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="80.00"
          required
        />
      </Field>

      <Field
        label={t.withdraw.form.network}
        htmlFor="networkCode"
        errors={state && !state.ok ? state.fieldErrors?.networkCode : undefined}
      >
        <Select id="networkCode" name="networkCode" value={code} onChange={(e) => setCode(e.target.value)} required>
          {networks.map((n) => (
            <option key={n.code} value={n.code} disabled={!n.enabled}>
              {n.name}
              {!n.enabled ? t.withdraw.form.disabledSuffix : ''}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label={t.withdraw.form.destination}
        htmlFor="address"
        errors={state && !state.ok ? state.fieldErrors?.address : undefined}
        hint={network ? `${network.name} · ${t.withdraw.form.destinationHint}` : undefined}
      >
        <Input
          id="address"
          name="address"
          placeholder={network?.code === 'TRC20' ? 'T…' : '0x…'}
          autoComplete="off"
          spellCheck={false}
          className="font-mono text-xs"
          required
        />
      </Field>

      {net !== null && Number.isFinite(net) && net > 0 ? (
        <div className="rounded-lg bg-surface-2 px-3 py-2.5 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-muted">{t.withdraw.form.youReceive}</span>
            <span className="tabular font-semibold">{formatUsdt(net)}</span>
          </div>
          <div className="mt-0.5 flex justify-between text-xs text-ink-subtle">
            <span>{t.withdraw.form.deducted}</span>
            <span className="tabular">{formatUsdt(numericAmount)}</span>
          </div>
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t.withdraw.form.submitting : t.withdraw.form.submit}
      </Button>

      <p className="text-xs text-ink-subtle">{t.withdraw.form.note}</p>
    </form>
  )
}

export function CancelWithdrawalButton({ withdrawalId }: { withdrawalId: string }) {
  const t = useT()
  const router = useRouter()
  const [state, action, pending] = useActionState(cancelWithdrawalAction, null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (state?.ok) router.refresh()
  }, [state, router])

  if (!confirming) {
    return (
      <div className="space-y-1">
        <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
          {t.withdraw.form.cancelRequest}
        </Button>
        {state && !state.ok ? <p className="text-xs text-negative">{state.error}</p> : null}
      </div>
    )
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="withdrawalId" value={withdrawalId} />
      <span className="text-xs text-ink-muted">{t.withdraw.form.confirmCancel}</span>
      <Button size="sm" variant="danger" type="submit" disabled={pending}>
        {pending ? t.withdraw.form.cancelling : t.withdraw.form.yesCancel}
      </Button>
      <Button size="sm" variant="ghost" type="button" onClick={() => setConfirming(false)} disabled={pending}>
        {t.withdraw.form.keep}
      </Button>
    </form>
  )
}
