import * as React from 'react'
import { Badge, Table, TableWrap, Td, Th } from '@/components/ui'
import { Mono } from '@/components/admin/controls'
import { formatUsdt } from '@/lib/format'
import type { VipPlan } from '@/types/database'

/* ------------------------------------------------------------------ */
/* Impact panels                                                       */
/*                                                                     */
/* Read-only arithmetic on the values currently stored, so the operator */
/* can see what a rate means in USDT before leaving the page.           */
/* ------------------------------------------------------------------ */
export function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 rounded-card border border-border bg-surface-2/50 p-4">
      <p className="label-mono text-ink-subtle">{title}</p>
      {note ? <p className="mt-1.5 text-xs text-ink-muted">{note}</p> : null}
      <div className="mt-3">{children}</div>
    </div>
  )
}

export function ReferralImpact({
  enabled,
  rates,
  totalRate,
  plans,
  chargeMode,
}: {
  enabled: boolean
  rates: number[]
  totalRate: number
  plans: VipPlan[]
  chargeMode: string
}) {
  if (!enabled) {
    return (
      <Panel title="Current effect">
        <p className="text-sm text-ink-muted">
          Commission is switched off. No level is paid on any activation, whatever the rates below say.
        </p>
      </Panel>
    )
  }

  return (
    <Panel
      title="What one activation pays out"
      note={`With the rates stored right now, ${(totalRate * 100).toFixed(2)} % of every activation charge is credited back up the tree, split across three levels. Charging mode is ${chargeMode}.`}
    >
      {plans.length === 0 ? (
        <p className="text-sm text-ink-muted">No active VIP plan to simulate against.</p>
      ) : (
        <TableWrap>
          <Table className="min-w-[32rem]">
            <thead>
              <tr>
                <Th>Plan activated</Th>
                <Th className="text-right">Charge</Th>
                <Th className="text-right">Level 1</Th>
                <Th className="text-right">Level 2</Th>
                <Th className="text-right">Level 3</Th>
                <Th className="text-right">Total out</Th>
                <Th className="text-right">Net kept</Th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const charge = Number(plan.activation_amount)
                const paid = rates.map((rate) => round2(charge * rate))
                const total = paid.reduce((sum, p) => sum + p, 0)
                return (
                  <tr key={plan.id}>
                    <Td className="font-medium">{plan.name}</Td>
                    <Td className="tabular text-right">{formatUsdt(charge)}</Td>
                    {paid.map((amount, index) => (
                      <Td key={index} className="tabular text-right text-ink-muted">
                        {amount.toFixed(2)}
                      </Td>
                    ))}
                    <Td className="tabular text-right font-semibold text-negative">−{total.toFixed(2)}</Td>
                    <Td className="tabular text-right font-semibold text-positive">
                      {(charge - total).toFixed(2)}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}
      <p className="mt-3 text-xs text-ink-subtle">
        A level is skipped when the ancestor does not exist, is suspended or banned, or when its rate is 0. An ancestor
        does not need an active plan of their own to be paid.
      </p>
    </Panel>
  )
}

export function UpgradeImpact({
  chargeMode,
  plans,
  totalRate,
}: {
  chargeMode: string
  plans: VipPlan[]
  totalRate: number
}) {
  if (plans.length < 2) return null

  // Walking every plan in order is the worst case for the platform: it is
  // what a member who upgrades one step at a time actually costs.
  const amounts = plans.map((p) => Number(p.activation_amount))
  const fullTotal = amounts.reduce((sum, a) => sum + a, 0)
  const diffTotal = amounts[amounts.length - 1]!
  const top = plans[plans.length - 1]!

  return (
    <Panel
      title="What the charging mode costs you"
      note={`One member climbing every tier in order, from ${plans[0]!.name} up to ${top.name}.`}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <ModeCard
          active={chargeMode === 'FULL'}
          label="FULL"
          charged={fullTotal}
          commission={round2(fullTotal * totalRate)}
          note="Each step is billed at the new plan's full price, so commission is paid again on the whole amount every time."
        />
        <ModeCard
          active={chargeMode === 'DIFFERENCE'}
          label="DIFFERENCE"
          charged={diffTotal}
          commission={round2(diffTotal * totalRate)}
          note="Each step bills only the gap, so the member pays the top plan's price in total and commission is paid once over."
        />
      </div>
    </Panel>
  )
}

function ModeCard({
  active,
  label,
  charged,
  commission,
  note,
}: {
  active: boolean
  label: string
  charged: number
  commission: number
  note: string
}) {
  return (
    <div
      className={`rounded-card border p-3.5 ${
        active ? 'border-brand bg-surface' : 'border-border bg-surface/60'
      }`}
    >
      <div className="flex items-center gap-2">
        <Mono className="font-semibold">{label}</Mono>
        {active ? <Badge tone="brand">In use</Badge> : null}
      </div>
      <dl className="mt-2.5 space-y-1 text-sm">
        <Line label="Member is charged" value={formatUsdt(charged)} />
        <Line label="Commission paid out" value={formatUsdt(commission)} tone="negative" />
        <Line label="Platform keeps" value={formatUsdt(charged - commission)} tone="positive" />
      </dl>
      <p className="mt-2 text-xs text-ink-subtle">{note}</p>
    </div>
  )
}

export function TaskRewardImpact({ plans }: { plans: VipPlan[] }) {
  if (plans.length === 0) return null

  return (
    <Panel
      title="Reward each plan pays today"
      note="Computed the same way compute_task_reward() does: activation amount × reward rate ÷ daily task limit. Edit the inputs under VIP plans."
    >
      <TableWrap>
        <Table className="min-w-[34rem]">
          <thead>
            <tr>
              <Th>Plan</Th>
              <Th className="text-right">Capital</Th>
              <Th className="text-right">Rate / day</Th>
              <Th className="text-right">Per task</Th>
              <Th className="text-right">Per day</Th>
              <Th className="text-right">Capital returned in</Th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => {
              const capital = Number(plan.activation_amount)
              const rate = Number(plan.reward_rate)
              const limit = plan.daily_task_limit || 1
              const perDay = capital * rate
              const perTask = perDay / limit
              const days = rate > 0 ? Math.ceil(1 / rate) : null
              return (
                <tr key={plan.id}>
                  <Td className="font-medium">{plan.name}</Td>
                  <Td className="tabular text-right">{formatUsdt(capital)}</Td>
                  <Td className="tabular text-right">{(rate * 100).toFixed(3)} %</Td>
                  <Td className="tabular text-right">{perTask.toFixed(2)}</Td>
                  <Td className="tabular text-right font-semibold">{perDay.toFixed(2)}</Td>
                  <Td className="tabular text-right text-ink-muted">{days === null ? '—' : `${days} days`}</Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </TableWrap>
      <p className="mt-3 text-xs text-ink-subtle">
        A plan has no end date and no payout cap, so &quot;capital returned in&quot; is the point past which a member has
        been paid more than they were charged, and keeps earning.
      </p>
    </Panel>
  )
}

function Line({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd
        className={`tabular font-medium ${
          tone === 'positive' ? 'text-positive' : tone === 'negative' ? 'text-negative' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  )
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
