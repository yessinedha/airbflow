'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  cancelDepositAction,
  createDepositIntentAction,
  recheckDepositAction,
  submitDepositProofAction,
} from '@/lib/deposits/actions'
import { Alert, Button, Field, Input, Select } from '@/components/ui'
import { IconCopy } from '@/components/icons'
import { formatUsdt } from '@/lib/format'
import { useT } from '@/lib/i18n/client'
import { parsePaymentProofOcr } from '@/lib/deposits/payment-proof-ocr'

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
            ? t.deposit.form.amountHint(formatUsdt(network.minDeposit))
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

export function SubmitDepositProofForm({
  depositId,
  amount,
  networkCode,
  toAddress,
}: {
  depositId: string
  amount: string
  networkCode: string
  toAddress: string
}) {
  const t = useT()
  const router = useRouter()
  const [state, action, pending] = useActionState(submitDepositProofAction, null)
  const [file, setFile] = useState<File | null>(null)
  const [ocr, setOcr] = useState<ReturnType<typeof parsePaymentProofOcr> | null>(null)
  const [ocrBusy, setOcrBusy] = useState(false)
  const [ocrError, setOcrError] = useState('')

  useEffect(() => {
    if (state?.ok) router.refresh()
  }, [state, router])

  async function readScreenshot(nextFile: File | undefined) {
    setFile(nextFile ?? null)
    setOcr(null)
    setOcrError('')
    if (!nextFile) return
    if (nextFile.size > 3 * 1024 * 1024) {
      setOcrError(t.deposit.form.proofFileTooLarge)
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(nextFile.type)) {
      setOcrError(t.deposit.form.proofInvalidFile)
      return
    }

    setOcrBusy(true)
    let worker: Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>> | undefined
    try {
      const { createWorker } = await import('tesseract.js')
      worker = await createWorker('fra', undefined, {
        langPath: 'https://tessdata.projectnaptha.com/4.0.0_fast',
        errorHandler: (error) => console.error('Payment proof OCR worker error:', error),
      })
      const result = await worker.recognize(nextFile)
      setOcr(parsePaymentProofOcr(result.data.text, { amount, networkCode, address: toAddress }))
    } catch (error) {
      console.error('Payment proof OCR failed:', error)
      setOcrError(t.deposit.form.proofOcrFailed)
    } finally {
      if (worker) {
        try {
          await worker.terminate()
        } catch (error) {
          console.error('Payment proof OCR worker termination failed:', error)
        }
      }
      setOcrBusy(false)
    }
  }

  const canSubmit = Boolean(file && ocr && ocr.issues.length === 0 && !ocrBusy && !pending)

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="depositId" value={depositId} />
      <input type="hidden" name="ocrAmount" value={ocr?.data.amount ?? ''} />
      <input type="hidden" name="ocrNetwork" value={ocr?.data.network ?? ''} />
      <input type="hidden" name="ocrStatus" value={ocr?.data.status ?? ''} />
      <input type="hidden" name="ocrDate" value={ocr?.data.date ?? ''} />
      <input type="hidden" name="ocrAddressMatched" value={ocr?.data.addressMatched ? 'true' : 'false'} />
      <input type="hidden" name="ocrText" value={ocr?.data.rawText ?? ''} />

      {state && !state.ok ? <Alert tone="negative">{state.error}</Alert> : null}
      {ocrError ? <Alert tone="negative">{ocrError}</Alert> : null}

      <p className="text-xs text-ink-muted">{t.deposit.form.proofInstructions}</p>
      <Field label={t.deposit.form.proofScreenshot} htmlFor={`proof-${depositId}`}>
        <Input
          id={`proof-${depositId}`}
          name="screenshot"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          className="h-auto py-2 file:me-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand"
          onChange={(event) => void readScreenshot(event.currentTarget.files?.[0])}
        />
      </Field>

      {ocrBusy ? <p className="text-xs text-ink-muted">{t.deposit.form.proofOcrRunning}</p> : null}
      {ocr && ocr.issues.length === 0 ? (
        <Alert tone="positive" title={t.deposit.form.proofOcrComplete}>
          {t.deposit.form.proofOcrSummary(ocr.data.amount, ocr.data.network, ocr.data.status, ocr.data.date)}
        </Alert>
      ) : null}
      {ocr && ocr.issues.length > 0 ? (
        <Alert tone="negative" title={t.deposit.form.proofOcrIncomplete}>
          <ul className="list-disc space-y-1 ps-5">
            {ocr.issues.map((issue) => (
              <li key={issue}>{t.deposit.form.proofErrors[issue]}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <Button type="submit" disabled={!canSubmit} className="w-full">
        {pending ? t.deposit.form.proofSubmitting : t.deposit.form.proofSubmit}
      </Button>
      <p className="text-xs text-ink-subtle">{t.deposit.form.proofPrivacy}</p>
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

export function CancelDepositButton({ depositId }: { depositId: string }) {
  const t = useT()
  const router = useRouter()
  const [state, action, pending] = useActionState(cancelDepositAction, null)

  useEffect(() => {
    if (state?.ok) router.refresh()
  }, [state, router])

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="depositId" value={depositId} />
      <Button type="submit" variant="danger" size="sm" disabled={pending}>
        {pending ? t.deposit.form.cancelling : t.deposit.form.cancelVerification}
      </Button>
      {state && !state.ok ? <p className="text-xs text-negative">{state.error}</p> : null}
    </form>
  )
}
