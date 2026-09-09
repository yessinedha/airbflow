'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { claimTaskAction, startTaskAction } from '@/lib/tasks/actions'
import { Badge, Button, Card, CardBody, MonoLabel } from '@/components/ui'
import { IconCheck, IconClock } from '@/components/icons'
import { formatDuration, formatUsdt } from '@/lib/format'
import type { AssignmentStatus, TaskDifficulty } from '@/types/database'
import { useT } from '@/lib/i18n/client'

export interface TaskCardData {
  assignmentId: string
  slot: number
  title: string
  description: string
  taskType: string
  difficulty: TaskDifficulty
  /** Optional illustration. Decorative: no rule depends on it. */
  imageUrl: string | null
  status: AssignmentStatus
  startedAt: string | null
  durationSeconds: number
  rewardPreview: number
  rewardEarned: number
  canClaim: boolean
}

const DIFFICULTY_TONE = { EASY: 'positive', MEDIUM: 'warning', HARD: 'negative' } as const

/**
 * The countdown shown here is cosmetic.
 *
 * `serverNowMs` is the database clock at render time; the browser clock is
 * only used to measure elapsed time since that reading, so changing the
 * device time cannot shorten the wait. The claim is refused by
 * `claim_task()` anyway until `now() >= started_at + duration_seconds`.
 */
export function TaskCard({ task, serverNowMs, canWork }: { task: TaskCardData; serverNowMs: number; canWork: boolean }) {
  const t = useT()
  const router = useRouter()
  const [startState, startAction, startPending] = useActionState(startTaskAction, null)
  const [claimState, claimAction, claimPending] = useActionState(claimTaskAction, null)

  // Offset between this browser's clock and the server's. Measured on mount,
  // as close as possible to the moment `serverNowMs` was read, then reused so
  // that later clock changes on the device cannot shorten the countdown.
  const clockOffsetRef = useRef<number>(0)
  const [remaining, setRemaining] = useState<number>(() => initialRemaining(task, serverNowMs))

  useEffect(() => {
    clockOffsetRef.current = Date.now() - serverNowMs
  }, [serverNowMs])

  const status = startState?.ok ? 'STARTED' : claimState?.ok ? 'COMPLETED' : task.status
  const startedAt = startState?.ok ? (startState.data.started_at ?? task.startedAt) : task.startedAt

  useEffect(() => {
    if (status !== 'STARTED' || !startedAt) return

    const tick = () => {
      const target = new Date(startedAt).getTime() + task.durationSeconds * 1000
      const serverNow = Date.now() - clockOffsetRef.current
      setRemaining(Math.max(0, Math.ceil((target - serverNow) / 1000)))
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [status, startedAt, task.durationSeconds])

  // Refresh server data once a claim lands so balances update everywhere.
  useEffect(() => {
    if (claimState?.ok) router.refresh()
  }, [claimState, router])

  const completed = status === 'COMPLETED'
  const started = status === 'STARTED'
  const claimable = started && remaining <= 0

  const reward = useMemo(
    () => (completed ? (claimState?.ok ? Number(claimState.data.reward_amount) : task.rewardEarned) : task.rewardPreview),
    [completed, claimState, task.rewardEarned, task.rewardPreview],
  )

  const error = startState && !startState.ok ? startState.error : claimState && !claimState.ok ? claimState.error : null

  const progress = Math.min(
    100,
    Math.max(0, ((task.durationSeconds - remaining) / Math.max(task.durationSeconds, 1)) * 100),
  )

  return (
    <Card className="animate-rise flex flex-col overflow-hidden">
      <ListingPlate
        slot={task.slot}
        imageUrl={task.imageUrl}
        title={task.title}
        /* Sharp for the whole review window: the member is looking at it. */
        revealed={started}
      />

      <CardBody className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <MonoLabel className="text-ink-subtle">
                {t.tasks.card.counter(task.slot, Math.max(task.slot, 3))}
              </MonoLabel>
              <Badge tone={DIFFICULTY_TONE[task.difficulty]}>{t.tasks.card.difficulty[task.difficulty]}</Badge>
              {completed ? (
                <Badge tone="positive">
                  <IconCheck width={11} height={11} />
                  {t.tasks.card.completed}
                </Badge>
              ) : null}
            </div>
            <h3 className="display mt-1.5 text-lg font-semibold">{task.title}</h3>
          </div>
          <div className="shrink-0 text-end">
            <MonoLabel>{completed ? t.tasks.card.earned : t.tasks.card.reward}</MonoLabel>
            <p className="tabular mt-1 text-sm font-semibold text-positive">{formatUsdt(reward)}</p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-ink-muted">{task.description}</p>

        {started ? (
          <div className="overflow-hidden rounded-card border border-espresso-border bg-espresso p-4 text-center text-espresso-ink">
            <p className="label-mono flex items-center justify-center gap-1.5 text-espresso-muted">
              <IconClock width={12} height={12} />
              {claimable ? t.tasks.card.windowDone : t.tasks.card.windowOpen}
            </p>
            <p
              className="tabular mt-1.5 text-4xl font-semibold tracking-tight"
              role="timer"
              aria-live="off"
              aria-label={t.tasks.card.secondsRemaining(remaining)}
            >
              {formatDuration(remaining)}
            </p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-espresso-border">
              <div
                className="h-full rounded-full bg-espresso-accent transition-[width] duration-1000 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-control bg-negative-soft px-3 py-2 text-sm text-negative" role="alert">
            {error}
          </p>
        ) : null}

        {claimState?.ok ? (
          <p className="rounded-control bg-positive-soft px-3 py-2 text-sm text-positive" role="status">
            {claimState.message}
          </p>
        ) : null}

        <div className="mt-auto pt-1">
          {completed ? (
            <Button variant="secondary" disabled className="w-full">
              {t.tasks.card.claimed}
            </Button>
          ) : started ? (
            <form action={claimAction}>
              <input type="hidden" name="assignmentId" value={task.assignmentId} />
              <Button type="submit" variant="success" className="w-full" disabled={!claimable || claimPending}>
                {claimPending
                  ? t.tasks.card.claiming
                  : claimable
                    ? t.tasks.card.claim(formatUsdt(reward))
                    : t.tasks.card.claimIn(formatUsdt(reward), formatDuration(remaining))}
              </Button>
            </form>
          ) : (
            <form action={startAction}>
              <input type="hidden" name="assignmentId" value={task.assignmentId} />
              <Button type="submit" variant="dark" className="w-full" disabled={startPending || !canWork}>
                {startPending ? t.tasks.card.starting : t.tasks.card.start}
              </Button>
            </form>
          )}

          <p className="mt-2 text-center text-xs text-ink-subtle">
            {!canWork && !completed
              ? t.tasks.card.needPlan
              : completed
                ? t.tasks.card.recorded
                : t.tasks.card.windowNote(task.durationSeconds)}
          </p>
        </div>
      </CardBody>
    </Card>
  )
}

/** First paint value, derived only from server-supplied timestamps. */
function initialRemaining(task: TaskCardData, serverNowMs: number): number {
  if (task.status !== 'STARTED' || !task.startedAt) return task.durationSeconds
  const target = new Date(task.startedAt).getTime() + task.durationSeconds * 1000
  return Math.max(0, Math.ceil((target - serverNowMs) / 1000))
}

/* ------------------------------------------------------------------ */
/* Listing plate                                                       */
/*                                                                     */
/* The photo is soft by default and sharpens as the member engages:    */
/* hovering or focusing eases the blur off, clicking opens a taller    */
/* view, and starting the task keeps it sharp for the whole window.    */
/* Purely presentational — nothing here reaches a server action.       */
/* ------------------------------------------------------------------ */
function ListingPlate({
  slot,
  imageUrl,
  title,
  revealed,
}: {
  slot: number
  imageUrl: string | null
  title: string
  revealed: boolean
}) {
  const t = useT()
  const [expanded, setExpanded] = useState(false)
  const sharp = revealed || expanded
  const lot = t.tasks.card.lot(slot.toString().padStart(4, '0'))

  if (!imageUrl) {
    return (
      <div className="relative h-24 border-b border-border bg-surface-2 sm:h-28">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: 'repeating-linear-gradient(135deg, var(--border-strong) 0 1px, transparent 1px 11px)',
          }}
        />
        <span className="label-mono absolute start-3 top-3 rounded-full bg-surface px-2 py-1 text-ink-muted shadow-card">
          {lot}
        </span>
        <span className="label-mono absolute bottom-3 end-3 text-ink-subtle">{t.tasks.card.noPhoto}</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      aria-pressed={expanded}
      aria-label={expanded ? t.tasks.card.collapse(title) : t.tasks.card.enlarge(title)}
      className={`group relative block w-full overflow-hidden border-b border-border bg-surface-2 text-start transition-[height] duration-300 ease-out ${
        expanded ? 'h-56 sm:h-64' : 'h-24 sm:h-28'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- operator-supplied
          URL on an arbitrary host; next/image would need every domain listed. */}
      <img
        src={imageUrl}
        alt={`Listing photograph for ${title}`}
        loading="lazy"
        decoding="async"
        className={`h-full w-full object-cover transition-[filter,transform] duration-500 ease-out ${
          sharp ? 'scale-100 blur-0' : 'scale-[1.06] blur-[3px] group-hover:scale-100 group-hover:blur-[1px]'
        }`}
      />

      {/* Keeps the pills legible over any photograph. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-espresso/25 via-transparent to-espresso/35"
      />

      <span className="label-mono absolute start-3 top-3 rounded-full bg-surface/90 px-2 py-1 text-ink-muted shadow-card backdrop-blur-sm">
        {lot}
      </span>

      <span className="label-mono absolute bottom-3 end-3 rounded-full bg-surface/85 px-2 py-1 text-ink-muted opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
        {expanded ? t.tasks.card.clickShrink : t.tasks.card.clickEnlarge}
      </span>
    </button>
  )
}
