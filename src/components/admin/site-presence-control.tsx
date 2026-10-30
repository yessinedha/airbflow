'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui'
import { ActionFeedback, useRefreshOnSuccess } from '@/components/admin/base'
import { confirmSitePresenceAction } from '@/lib/admin/actions'
import type { ActionResult } from '@/lib/security/errors'

export function SitePresenceControl({
  isClosed,
  confirmedAt,
  statusError,
}: {
  isClosed: boolean | null
  confirmedAt: string | null
  statusError?: string
}) {
  const [state, action, pending] = useActionState(
    confirmSitePresenceAction,
    null as ActionResult<unknown> | null,
  )
  useRefreshOnSuccess(state)

  return (
    <div className="space-y-3">
      {statusError ? (
        <p role="alert" className="text-sm text-negative">
          Could not load the presence-switch status: {statusError}
        </p>
      ) : (
        <>
          <p className="text-sm text-ink-muted">
            {isClosed === null
              ? 'The site status is unavailable.'
              : isClosed
                ? 'The public site is currently closed. Confirming presence will reopen it.'
                : 'The public site is open. Confirm once each day by 17:00 Tunisia time.'}
          </p>
          <p className="text-xs text-ink-subtle">
            Deadline: 17:00 Africa/Tunis · 15-minute grace period. A missed check-in closes public access until you
            confirm again here. Data and infrastructure are not deleted.
          </p>
          {confirmedAt ? (
            <p className="text-xs text-ink-subtle">
              Last confirmation:{' '}
              {new Intl.DateTimeFormat('en-GB', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'Africa/Tunis',
              }).format(new Date(confirmedAt))}{' '}
              (Tunisia time)
            </p>
          ) : null}
        </>
      )}
      <form action={action} className="space-y-2">
        <ActionFeedback state={state} />
        <Button type="submit" disabled={pending}>
          {pending ? 'Confirming…' : 'Confirm my presence'}
        </Button>
      </form>
    </div>
  )
}
