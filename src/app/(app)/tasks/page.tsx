import type { Metadata } from 'next'
import { requireSession } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { serverClockMs, utcToday } from '@/lib/dashboard/queries'
import { Alert, ButtonLink, Card, CardBody, EmptyState, PageHeader, Stat } from '@/components/ui'
import { TaskCard, type TaskCardData } from '@/components/task-card'
import { formatDateTime, formatUsdt } from '@/lib/format'
import type { AssignmentStatus, TaskAssignment, TaskDifficulty } from '@/types/database'
import { getT } from '@/lib/i18n/server'

export const metadata: Metadata = { title: 'Daily tasks' }
export const dynamic = 'force-dynamic'

interface AssignmentRow extends TaskAssignment {
  task: {
    id: string
    title: string
    description: string
    task_type: string
    difficulty: TaskDifficulty
    duration_seconds: number
    image_url: string | null
  } | null
}

export default async function TasksPage() {
  const session = await requireSession('/tasks')
  const supabase = await createSupabaseServerClient()
  const today = utcToday()
  const { data: taskLockData, error: taskLockError } = await supabase.rpc('current_user_task_lock_status')
  if (taskLockError) console.error('[tasks] withdrawal lock status failed', taskLockError.message)
  const taskLock = taskLockData as { locked: boolean; locked_until: string | null; duration_hours: number } | null
  const withdrawalLocked = taskLockError ? true : Boolean(taskLock?.locked)

  // Idempotent: creates today's assignments the first time the page is
  // opened each UTC day, and tops them up after a VIP upgrade.
  if (!withdrawalLocked) {
    const { error } = await supabase.rpc('ensure_daily_assignments')
    if (error) console.error('[tasks] daily assignment creation failed', error.message)
  }

  const { data: assignments } = await supabase
    .from('task_assignments')
    .select('*, task:tasks(id, title, description, task_type, difficulty, duration_seconds, image_url)')
    .eq('user_id', session.userId)
    .eq('assigned_date', today)
    .order('slot', { ascending: true })
    .returns<AssignmentRow[]>()

  const rows = assignments ?? []

  // Reward previews come from the same SQL function the claim uses, so the
  // figure on the button can never disagree with what is actually paid.
  const previews = await Promise.all(
    rows.map(async (row) => {
      if (!session.profile.current_vip_plan_id) return 0
      const { data } = await supabase.rpc('compute_task_reward', {
        p_plan_id: session.profile.current_vip_plan_id,
        p_task_id: row.task_id,
      })
      return Number(data ?? 0)
    }),
  )

  const serverNowMs = serverClockMs()
  const completed = rows.filter((r) => r.status === 'COMPLETED')
  const dailyLimit = session.vipPlan?.daily_task_limit ?? rows.length
  const earnedToday = completed.reduce((sum, r) => sum + Number(r.reward_amount), 0)
  const potentialToday = previews.reduce((sum, p) => sum + p, 0)
  const t = await getT()
  const canWork = session.profile.status === 'ACTIVE' && Boolean(session.vipPlan) && !withdrawalLocked
  const workDisabledReason = withdrawalLocked ? t.tasks.card.withdrawalLocked : undefined

  const cards: TaskCardData[] = rows.map((row, index) => ({
    assignmentId: row.id,
    slot: row.slot,
    title: row.task?.title ?? t.tasks.titlePlain,
    description: row.task?.description ?? '',
    taskType: row.task?.task_type ?? '',
    difficulty: row.task?.difficulty ?? 'EASY',
    imageUrl: row.task?.image_url ?? null,
    status: row.status as AssignmentStatus,
    startedAt: row.started_at,
    durationSeconds: row.duration_seconds,
    rewardPreview: previews[index] ?? 0,
    rewardEarned: Number(row.reward_amount),
    canClaim: row.status === 'STARTED',
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t.tasks.eyebrow(rows.length)}
        title={rows.length > 0 ? t.tasks.titleWaiting(rows.length) : t.tasks.titlePlain}
        description={t.tasks.description(rows[0]?.duration_seconds ?? 180)}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label={t.tasks.completedToday}
          value={`${completed.length} / ${dailyLimit}`}
          tone={completed.length ? 'positive' : undefined}
        />
        <Stat label={t.tasks.earnedToday} value={formatUsdt(earnedToday)} tone="positive" />
        <Stat
          label={t.tasks.availableToday}
          value={formatUsdt(Math.max(potentialToday - earnedToday, 0))}
          sub={session.vipPlan ? t.tasks.basedOn(session.vipPlan.name) : t.tasks.requiresPlan}
        />
      </div>

      {session.profile.status !== 'ACTIVE' ? (
        <Alert tone="negative" title={t.tasks.disabledTitle}>
          {t.tasks.disabledBody(t.statuses.user[session.profile.status])}
        </Alert>
      ) : !session.vipPlan ? (
        <Alert tone="info" title={t.tasks.needPlanTitle}>
          <p>{t.tasks.needPlanBody}</p>
          <div className="mt-3">
            <ButtonLink href="/vip" size="sm">
              {t.dashboard.viewPlans}
            </ButtonLink>
          </div>
        </Alert>
      ) : null}

      {withdrawalLocked ? (
        <Alert tone="warning" title={t.tasks.withdrawalLockTitle}>
          {taskLock?.locked_until
            ? t.tasks.withdrawalLockBody(formatDateTime(taskLock.locked_until))
            : t.tasks.withdrawalLockUnknown}
        </Alert>
      ) : null}

      {cards.length === 0 ? (
        <EmptyState
          title={t.tasks.noTasksTitle}
          description={t.tasks.noTasksBody}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {cards.map((card) => (
            <TaskCard
              key={card.assignmentId}
              task={card}
              serverNowMs={serverNowMs}
              canWork={canWork}
              disabledReason={workDisabledReason}
            />
          ))}
        </div>
      )}

      <Card>
        <CardBody className="text-sm text-ink-muted">
          <p className="font-medium text-ink">{t.tasks.howTitle}</p>
          <ul className="mt-2 list-disc space-y-1 ps-5">
            {t.tasks.howItems(dailyLimit).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  )
}
