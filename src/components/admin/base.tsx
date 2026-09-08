'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button, type ButtonProps } from '@/components/ui'
import type { ActionResult } from '@/lib/security/errors'

/**
 * Shared client-side plumbing for the admin forms.
 *
 * Every admin mutation is a server action returning `ActionResult`, so the
 * feedback rendering and the "refresh the RSC tree on success" behaviour
 * can be written once here.
 */

export function ActionFeedback({ state }: { state: ActionResult<unknown> | null }) {
  if (!state) return null
  return (
    <Alert tone={state.ok ? 'positive' : 'negative'} className="mb-3">
      {state.ok ? (state.message ?? 'Done.') : state.error}
    </Alert>
  )
}

/**
 * Refreshes the server-rendered data whenever an action reports success.
 *
 * Deliberately does nothing else: local form state is never reset from
 * inside an effect. Where a form must clear itself, the page gives it a
 * `key` derived from the data it changed, so a successful write remounts it.
 */
export function useRefreshOnSuccess(state: ActionResult<unknown> | null) {
  const router = useRouter()
  useEffect(() => {
    if (state?.ok) router.refresh()
  }, [state, router])
}

export function SubmitButton({
  pending,
  children,
  pendingLabel = 'Working…',
  ...props
}: ButtonProps & { pending: boolean; pendingLabel?: string }) {
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  )
}

/**
 * Collapsible panel used to keep destructive or rarely used forms out of
 * the way until an operator deliberately opens them.
 */
export function Disclosure({
  label,
  tone = 'secondary',
  children,
  defaultOpen = false,
}: {
  label: string
  tone?: ButtonProps['variant']
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  if (!open) {
    return (
      <Button size="sm" variant={tone} onClick={() => setOpen(true)}>
        {label}
      </Button>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{label}</p>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
      {children}
    </div>
  )
}
