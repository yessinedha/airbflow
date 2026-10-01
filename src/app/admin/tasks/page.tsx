import type { Metadata } from 'next'
import { loadTasks } from '@/lib/admin/queries'
import { Alert, Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader } from '@/components/ui'
import { TaskForm, TaskImageManager } from '@/components/admin/config-forms'
import { formatDuration, formatUsdt } from '@/lib/format'

export const metadata: Metadata = { title: 'Tasks' }
export const dynamic = 'force-dynamic'

export default async function AdminTasksPage() {
  const tasks = await loadTasks()
  const activeCount = tasks.filter((t) => t.active).length

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tasks"
        description="The pool of crypto market-analysis exercises used for daily assignments. Deactivating an exercise stops it being assigned from the next UTC day; assignments already issued are untouched."
      />

      {activeCount < 3 ? (
        <Alert tone="warning" title="Fewer than three active tasks">
          Each user is issued up to three tasks per day, and a user can never receive the same task twice on one day.
          With only {activeCount} active task{activeCount === 1 ? '' : 's'}, users will receive fewer than a full day of
          work.
        </Alert>
      ) : null}

      {tasks.length === 0 ? (
        <EmptyState title="No tasks" description="Create the first task below, or run supabase/seed.sql." />
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <Card key={task.id}>
              <CardBody className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold">{task.title}</p>
                      {task.active ? <Badge tone="positive">Active</Badge> : <Badge tone="warning">Inactive</Badge>}
                      <Badge>{task.difficulty}</Badge>
                    </div>
                    <p className="mt-1 max-w-2xl text-sm text-ink-muted">{task.description}</p>
                  </div>
                  <TaskForm task={task} />
                </div>

                <TaskImageManager task={task} />

                <div className="grid gap-2 text-sm sm:grid-cols-3">
                  <div className="rounded-lg bg-surface-2 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-ink-subtle">Type</p>
                    <p className="font-mono text-xs">{task.task_type}</p>
                  </div>
                  <div className="rounded-lg bg-surface-2 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-ink-subtle">Timer</p>
                    <p className="tabular font-semibold">{formatDuration(task.duration_seconds)}</p>
                    <p className="text-xs text-ink-subtle">{task.duration_seconds}s, validated server-side</p>
                  </div>
                  <div className="rounded-lg bg-surface-2 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-ink-subtle">Reward</p>
                    <p className="tabular font-semibold">
                      {task.reward_amount === null ? 'From VIP plan' : formatUsdt(task.reward_amount)}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create a task</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          <TaskForm />
        </CardBody>
      </Card>
    </div>
  )
}
