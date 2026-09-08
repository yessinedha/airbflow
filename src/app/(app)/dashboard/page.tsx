import type { Metadata } from 'next'
import Link from 'next/link'
import { requireSession } from '@/lib/auth/session'
import { loadDashboard } from '@/lib/dashboard/queries'
import { formatSignedUsdt, formatUsdt, formatRelative } from '@/lib/format'
import {
  Alert,
  ButtonLink,
  Card,
  CardBody,
  EmptyState,
  MonoLabel,
  Panel,
  PanelGlow,
  ProgressRing,
  SectionTitle,
  Sparkline,
  Stat,
  Tile,
} from '@/components/ui'
import { LedgerTypeBadge } from '@/components/status'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await requireSession('/dashboard')
  const data = await loadDashboard(session.userId)
  const { profile, vipPlan } = session

  const displayName = profile.username ?? profile.email.split('@')[0]
  const dailyLimit = data.tasksTotal || vipPlan?.daily_task_limit || 3

  // Decorative column chart drawn from the ledger rows already loaded for the
  // activity list — oldest first, absolute amounts. No extra query.
  const movement = [...data.recentLedger].reverse().map((entry) => Math.abs(Number(entry.amount)))

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })

  return (
    <div className="space-y-7">
      <header>
        <MonoLabel>{today} · UTC</MonoLabel>
        <h1 className="display mt-1.5 text-3xl font-semibold sm:text-4xl">Welcome back, {displayName}</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Here is the current state of your account. Every figure below is an internal platform ledger balance.
        </p>
      </header>

      {profile.status !== 'ACTIVE' ? (
        <Alert tone="negative" title={`Your account is ${profile.status.toLowerCase()}`}>
          Tasks, deposits and withdrawals are disabled while your account is in this state. Contact support for details.
        </Alert>
      ) : null}

      {/* Balance + day panel ------------------------------------------ */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="animate-rise lg:col-span-3">
          <PanelGlow />
          <div className="relative p-5 sm:p-6">
            <MonoLabel className="text-espresso-muted">Internal platform balance · ledger</MonoLabel>
            <p className="tabular mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
              {formatUsdt(profile.balance_available).replace(' USDT', '')}
              <span className="ml-2 font-mono text-base font-normal text-espresso-muted">USDT</span>
            </p>
            <p className="mt-3 max-w-lg text-xs leading-relaxed text-espresso-muted">
              This is not an on-chain balance. It is a figure held in the platform&apos;s internal ledger, backed by your
              verified deposits and the rewards recorded against your account. Every movement is auditable.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <ButtonLink href="/deposit" size="sm">
                Deposit
              </ButtonLink>
              <ButtonLink
                href="/withdraw"
                size="sm"
                variant="secondary"
                className="border-espresso-border bg-transparent text-espresso-ink hover:bg-espresso-2"
              >
                Withdraw
              </ButtonLink>
              <ButtonLink
                href="/history"
                size="sm"
                variant="ghost"
                className="text-espresso-muted hover:bg-espresso-2 hover:text-espresso-ink"
              >
                View ledger →
              </ButtonLink>
            </div>

            {movement.length > 0 ? (
              <div className="mt-6 border-t border-espresso-border pt-4">
                <Sparkline values={movement} />
                <div className="mt-2 flex items-center justify-between">
                  <MonoLabel className="text-espresso-muted">Recent ledger movement</MonoLabel>
                  <MonoLabel className="text-espresso-muted">{movement.length} entries</MonoLabel>
                </div>
              </div>
            ) : null}
          </div>
        </Panel>

        <Card className="animate-rise flex flex-col lg:col-span-2" data-index="1">
          <CardBody className="flex flex-1 flex-col gap-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <MonoLabel>Today</MonoLabel>
                <p className="display mt-1 text-lg font-semibold">Task progress</p>
              </div>
              <ProgressRing value={data.tasksCompleted} max={dailyLimit} label="tasks" />
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
              <div>
                <MonoLabel>Earned today</MonoLabel>
                <p className="tabular mt-1 text-lg font-semibold text-positive">{formatUsdt(data.todaysRewards)}</p>
              </div>
              <div>
                <MonoLabel>Current tier</MonoLabel>
                <p className="display mt-1 text-lg font-semibold">{vipPlan ? vipPlan.name : 'None'}</p>
              </div>
            </div>

            <ButtonLink
              href="/tasks"
              size="sm"
              variant={data.tasksCompleted >= dailyLimit ? 'secondary' : 'dark'}
              className="mt-auto w-full"
            >
              {data.tasksCompleted >= dailyLimit ? 'All tasks completed' : 'Open daily tasks'}
            </ButtonLink>
          </CardBody>
        </Card>
      </div>

      {/* Key figures -------------------------------------------------- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total rewards" value={formatUsdt(profile.total_rewards)} sub="Credited to your ledger" />
        <Stat label="Total deposited" value={formatUsdt(profile.total_deposited)} sub="Verified on chain" />
        <Stat label="Total withdrawn" value={formatUsdt(profile.total_withdrawn)} sub="Settled manually" />
        <Stat
          label="Pending withdrawal"
          value={formatUsdt(profile.balance_pending_withdrawal)}
          sub="Held while under review"
          tone={Number(profile.balance_pending_withdrawal) > 0 ? 'brand' : undefined}
        />
      </div>

      {/* Next steps --------------------------------------------------- */}
      {!vipPlan ? (
        <Alert tone="info" title="Activate a plan to start earning task rewards">
          <p>
            Task rewards are only paid to accounts with an active VIP plan. Activation is charged from your internal
            platform balance.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ButtonLink href="/vip" size="sm">
              View plans
            </ButtonLink>
            <ButtonLink href="/deposit" size="sm" variant="secondary">
              Deposit USDT
            </ButtonLink>
          </div>
        </Alert>
      ) : null}

      {data.eligibility && !data.eligibility.eligible && data.eligibility.reason === 'FIRST_WITHDRAWAL_WAITING_PERIOD' ? (
        <Alert tone="warning" title="First withdrawal not available yet">
          Your first withdrawal unlocks {data.eligibility.days_remaining} day
          {data.eligibility.days_remaining === 1 ? '' : 's'} from now, {data.eligibility.first_withdrawal_wait_days} days
          after your plan activation. After that you may withdraw once every {data.eligibility.withdrawal_cooldown_days}{' '}
          days.
        </Alert>
      ) : null}

      {/* Notifications ------------------------------------------------ */}
      {data.unreadNotifications.length > 0 ? (
        <section>
          <SectionTitle
            action={
              <Link href="/notifications" className="text-brand hover:underline">
                View all
              </Link>
            }
          >
            Unread notifications
          </SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.unreadNotifications.map((n) => (
              <Card key={n.id}>
                <CardBody className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium">{n.title}</p>
                    <span className="label-mono shrink-0 text-ink-subtle">{formatRelative(n.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">{n.message}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {/* Recent activity + team -------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <SectionTitle
            action={
              <Link href="/history" className="text-brand hover:underline">
                Full history
              </Link>
            }
          >
            Recent ledger
          </SectionTitle>

          <Card>
            <CardBody className="py-1">
              {data.recentLedger.length === 0 ? (
                <div className="py-6">
                  <EmptyState
                    title="No activity yet"
                    description="Your ledger will show every deposit, reward and withdrawal as soon as they happen."
                    action={
                      <ButtonLink href="/deposit" size="sm">
                        Make your first deposit
                      </ButtonLink>
                    }
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {data.recentLedger.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <LedgerTypeBadge type={entry.type} />
                        <p className="mt-1.5 truncate text-sm text-ink-muted">{entry.description ?? '—'}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={`tabular text-sm font-semibold ${
                            Number(entry.amount) >= 0 ? 'text-positive' : 'text-negative'
                          }`}
                        >
                          {formatSignedUsdt(entry.amount)}
                        </p>
                        <p className="label-mono mt-0.5 text-ink-subtle">{formatRelative(entry.created_at)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </section>

        <section className="lg:col-span-2">
          <SectionTitle
            action={
              <Link href="/team" className="text-brand hover:underline">
                Open
              </Link>
            }
          >
            Your team
          </SectionTitle>

          <Card>
            <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
              <Tile label="Total members" value={data.team?.total ?? 0} />
              <Tile label="Direct" value={data.team?.level1 ?? 0} />
            </div>
            <CardBody className="space-y-2 text-sm">
              <Row label="Level 1" value={data.team?.level1 ?? 0} />
              <Row label="Level 2" value={data.team?.level2 ?? 0} />
              <Row label="Level 3" value={data.team?.level3 ?? 0} />
              <p className="border-t border-border pt-3 text-xs leading-relaxed text-ink-subtle">
                Commission is paid from VIP activation fees collected by the platform, at rates the operator configures.
                It is not a share of another member&apos;s deposit.
              </p>
            </CardBody>
          </Card>
        </section>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      <span className="tabular font-medium">{value}</span>
    </div>
  )
}
