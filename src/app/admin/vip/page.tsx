import type { Metadata } from 'next'
import { loadVipPlans } from '@/lib/admin/queries'
import { Alert, Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader } from '@/components/ui'
import { VipPlanForm } from '@/components/admin/config-forms'
import { formatPercent, formatUsdt, toNumber } from '@/lib/format'

export const metadata: Metadata = { title: 'VIP plans' }
export const dynamic = 'force-dynamic'

export default async function AdminVipPage() {
  const plans = await loadVipPlans()

  return (
    <div className="space-y-5">
      <PageHeader
        title="VIP plans"
        description="Activation amounts, daily task limits and reward parameters. Changes apply to future task rewards only; entries already written to the ledger are never recalculated."
      />

      <Alert tone="info" title="Reward rate is an operational parameter">
        The reward rate defines the share of a plan&apos;s activation amount that funds a full day of task rewards. It
        is a budget the operator sets and can change, not a promised or guaranteed return, and it must never be
        presented to users as investment income.
      </Alert>

      {plans.length === 0 ? (
        <EmptyState title="No VIP plans" description="Create the first plan below, or run supabase/seed.sql." />
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => {
            const dailyPool = toNumber(plan.activation_amount) * toNumber(plan.reward_rate)
            const perTask = plan.daily_task_limit > 0 ? dailyPool / plan.daily_task_limit : 0

            return (
              <Card key={plan.id}>
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold">{plan.name}</p>
                        <Badge tone="neutral">Level {plan.level}</Badge>
                        {plan.active ? <Badge tone="positive">Active</Badge> : <Badge tone="warning">Inactive</Badge>}
                      </div>
                      {plan.description ? (
                        <p className="mt-1 max-w-2xl text-sm text-ink-muted">{plan.description}</p>
                      ) : null}
                    </div>
                    <VipPlanForm plan={plan} />
                  </div>

                  <div className="grid gap-2 text-sm sm:grid-cols-4">
                    <div className="rounded-lg bg-surface-2 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-ink-subtle">Activation</p>
                      <p className="tabular font-semibold">{formatUsdt(plan.activation_amount)}</p>
                    </div>
                    <div className="rounded-lg bg-surface-2 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-ink-subtle">Daily tasks</p>
                      <p className="tabular font-semibold">{plan.daily_task_limit}</p>
                    </div>
                    <div className="rounded-lg bg-surface-2 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-ink-subtle">Reward rate</p>
                      <p className="tabular font-semibold">{formatPercent(plan.reward_rate, 3)}</p>
                    </div>
                    <div className="rounded-lg bg-surface-2 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-ink-subtle">Reward per task</p>
                      <p className="tabular font-semibold">{formatUsdt(perTask)}</p>
                      <p className="text-xs text-ink-subtle">{formatUsdt(dailyPool)} per day</p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create a plan</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          <VipPlanForm />
        </CardBody>
      </Card>
    </div>
  )
}
