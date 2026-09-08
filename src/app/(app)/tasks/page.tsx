import type { Metadata } from 'next'
import { requireSession } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { serverClockMs, utcToday } from '@/lib/dashboard/queries'
import { Alert, ButtonLink, Card, CardBody, EmptyState, PageHeader, Stat } from '@/components/ui'
import { TaskCard, type TaskCardData } from '@/components/task-card'
import { formatUsdt } from '@/lib/format'
import type { AssignmentStatus, TaskAssignment, TaskDifficulty } from '@/types/database'

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

  // Idempotent: creates today's assignments the first time the page is
  // opened each UTC day, and tops them up after a VIP upgrade.
  await supabase.rpc('ensure_daily_assignments')

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
  const canWork = session.profile.status === 'ACTIVE' && Boolean(session.vipPlan)

  const cards: TaskCardData[] = rows.map((row, index) => ({
    assignmentId: row.id,
    slot: row.slot,
    title: row.task?.title ?? 'Verification task',
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
        eyebrow={`${rows.length} listing${rows.length === 1 ? '' : 's'} in today's batch`}
        title={
          rows.length > 0
            ? `${rows.length} listing${rows.length === 1 ? '' : 's'} waiting for you`
            : 'Daily tasks'
        }
        description={`Your task set resets every day at 00:00 UTC. Each task runs a ${
          rows[0]?.duration_seconds ?? 180
        }-second verification window measured on the server — the countdown on screen is only an indication.`}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Completed today" value={`${completed.length} / ${dailyLimit}`} tone={completed.length ? 'positive' : undefined} />
        <Stat label="Earned today" value={formatUsdt(earnedToday)} tone="positive" />
        <Stat
          label="Available today"
          value={formatUsdt(Math.max(potentialToday - earnedToday, 0))}
          sub={session.vipPlan ? `Based on ${session.vipPlan.name}` : 'Requires an active plan'}
        />
      </div>

      {session.profile.status !== 'ACTIVE' ? (
        <Alert tone="negative" title="Tasks are disabled">
          Your account is {session.profile.status.toLowerCase()}. Contact support for details.
        </Alert>
      ) : !session.vipPlan ? (
        <Alert tone="info" title="Activate a VIP plan to claim rewards">
          <p>
            You can view today&apos;s tasks, but rewards can only be claimed with an active plan. The reward amount is
            derived from your plan&apos;s configured task reward parameters.
          </p>
          <div className="mt-3">
            <ButtonLink href="/vip" size="sm">
              View plans
            </ButtonLink>
          </div>
        </Alert>
      ) : null}

      {cards.length === 0 ? (
        <EmptyState
          title="No tasks available"
          description="No active tasks are configured right now. Please check back later."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {cards.map((card) => (
            <TaskCard key={card.assignmentId} task={card} serverNowMs={serverNowMs} canWork={canWork} />
          ))}
        </div>
      )}

      <Card>
        <CardBody className="text-sm text-ink-muted">
          <p className="font-medium text-ink">How task rewards work</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Rewards are internal platform rewards credited to your platform ledger balance, not on-chain payments.</li>
            <li>The reward amount is calculated on the server from your active plan when you claim, never from your browser.</li>
            <li>
              The timer is enforced by the database. Claiming before the window has elapsed is rejected regardless of what
              your screen shows.
            </li>
            <li>You can complete at most {dailyLimit} tasks per day, and each task can be rewarded only once per day.</li>
          </ul>
        </CardBody>
      </Card>
    </div>
  )
}
