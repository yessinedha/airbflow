import type { Metadata } from 'next'
import { requireSession } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Alert, Badge, ButtonLink, Card, CardBody, CardHeader, CardTitle, PageHeader, Table, TableWrap, Td, Th } from '@/components/ui'
import { VipActivateButton } from '@/components/vip-activate'
import { formatDateTime, formatUsdt, toNumber } from '@/lib/format'
import type { UserVipPlan, VipPlan } from '@/types/database'

export const metadata: Metadata = { title: 'VIP plans' }
export const dynamic = 'force-dynamic'

interface HistoryRow extends UserVipPlan {
  previous_plan: { name: string } | null
  new_plan: { name: string } | null
}

export default async function VipPage() {
  const session = await requireSession('/vip')
  const supabase = await createSupabaseServerClient()

  const [{ data: plans }, { data: history }] = await Promise.all([
    supabase
      .from('vip_plans')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .returns<VipPlan[]>(),
    supabase
      .from('user_vip_plans')
      .select('*, previous_plan:vip_plans!user_vip_plans_previous_plan_id_fkey(name), new_plan:vip_plans!user_vip_plans_new_plan_id_fkey(name)')
      .eq('user_id', session.userId)
      .order('activated_at', { ascending: false })
      .returns<HistoryRow[]>(),
  ])

  const balance = toNumber(session.profile.balance_available)
  const currentLevel = session.vipPlan?.level ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="VIP plans"
        description="Activating a plan sets your daily task allowance and the task reward parameters used to calculate what each completed task pays."
        actions={
          <ButtonLink href="/deposit" variant="secondary" size="sm">
            Add funds
          </ButtonLink>
        }
      />

      <Alert tone="info" title="What a plan is, and what it is not">
        A plan is an activation fee paid from your internal platform balance. It unlocks a daily task allowance and sets
        the reward parameters for the verification work you complete. It is not a deposit into an investment product, it
        does not accrue interest, and it does not promise any return. Reward payments require you to actually complete
        tasks.
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(plans ?? []).map((plan) => {
          const amount = toNumber(plan.activation_amount)
          const dailyPool = amount * toNumber(plan.reward_rate)
          const perTask = plan.daily_task_limit > 0 ? dailyPool / plan.daily_task_limit : 0
          const isCurrent = plan.id === session.profile.current_vip_plan_id

          return (
            <Card key={plan.id} className={isCurrent ? 'border-brand' : undefined}>
              <CardHeader>
                <div>
                  <CardTitle>{plan.name}</CardTitle>
                  {plan.description ? <p className="mt-1 text-sm text-ink-muted">{plan.description}</p> : null}
                </div>
                {isCurrent ? <Badge tone="brand">Current</Badge> : null}
              </CardHeader>

              <CardBody className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-subtle">Activation amount</p>
                  <p className="tabular text-2xl font-semibold tracking-tight">{formatUsdt(amount)}</p>
                </div>

                <dl className="space-y-1.5 text-sm">
                  <Row label="Daily tasks" value={String(plan.daily_task_limit)} />
                  <Row label="Reward per task" value={formatUsdt(perTask)} />
                  <Row label="Daily task reward budget" value={formatUsdt(dailyPool)} />
                </dl>

                <VipActivateButton
                  planId={plan.id}
                  planName={plan.name}
                  amount={amount}
                  balance={balance}
                  isCurrent={isCurrent}
                  isDowngrade={plan.level < currentLevel}
                  disabled={session.profile.status !== 'ACTIVE'}
                />
              </CardBody>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your activation history</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {!history?.length ? (
            <p className="py-6 text-center text-sm text-ink-muted">You have not activated a plan yet.</p>
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>From</Th>
                    <Th>To</Th>
                    <Th className="text-right">Charged</Th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id}>
                      <Td className="whitespace-nowrap text-ink-muted">{formatDateTime(row.activated_at)}</Td>
                      <Td>{row.previous_plan?.name ?? '—'}</Td>
                      <Td className="font-medium">{row.new_plan?.name ?? '—'}</Td>
                      <Td className="tabular text-right">{formatUsdt(row.amount_charged)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
          <p className="mt-3 text-xs text-ink-subtle">
            Rewards already claimed under a previous plan are never recalculated. Each task assignment keeps the reward
            it was paid, and every ledger entry is immutable.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="tabular font-medium">{value}</dd>
    </div>
  )
}
