'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { activateVipAction } from '@/lib/vip/actions'
import { Button } from '@/components/ui'
import { formatUsdt } from '@/lib/format'
import { useT } from '@/lib/i18n/client'

/**
 * Activation spends real balance, so it always goes through an explicit
 * confirm step rather than firing on the first click.
 */
export function VipActivateButton({
  planId,
  planName,
  amount,
  balance,
  isCurrent,
  isDowngrade,
  disabled,
}: {
  planId: string
  planName: string
  amount: number
  balance: number
  isCurrent: boolean
  isDowngrade: boolean
  disabled?: boolean
}) {
  const t = useT()
  const router = useRouter()
  const [state, action, pending] = useActionState(activateVipAction, null)
  const [confirming, setConfirming] = useState(false)

  // On success the surrounding page re-renders with the new active plan,
  // which removes the confirm step on its own — so the effect only has to
  // ask for fresh server data.
  useEffect(() => {
    if (state?.ok) router.refresh()
  }, [state, router])

  const showConfirm = confirming && !state?.ok

  if (isCurrent) {
    return (
      <Button variant="secondary" className="w-full" disabled>
        {t.vip.activePlan}
      </Button>
    )
  }

  const insufficient = balance < amount

  if (isDowngrade) {
    return (
      <Button variant="secondary" className="w-full" disabled>
        {t.vip.lowerThanCurrent}
      </Button>
    )
  }

  return (
    <div className="space-y-2">
      {state && !state.ok ? (
        <p className="rounded-lg bg-negative-soft px-3 py-2 text-sm text-negative" role="alert">
          {state.error}
        </p>
      ) : null}

      {showConfirm ? (
        <form action={action} className="space-y-2">
          <input type="hidden" name="planId" value={planId} />
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-muted">
            {t.vip.confirmBody(formatUsdt(amount), planName)}
          </p>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={pending}>
              {pending ? t.vip.activating : t.common.confirm}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
              {t.common.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <Button
          className="w-full"
          onClick={() => setConfirming(true)}
          disabled={disabled || insufficient}
          title={insufficient ? t.vip.insufficient : undefined}
        >
          {insufficient ? t.vip.needMore(formatUsdt(amount - balance)) : t.vip.activateFor(formatUsdt(amount))}
        </Button>
      )}
    </div>
  )
}
