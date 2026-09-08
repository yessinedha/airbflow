import type { Metadata } from 'next'
import Link from 'next/link'
import { loadAdminOverview } from '@/lib/admin/queries'
import { Alert, Badge, Card, CardBody, CardHeader, CardTitle, PageHeader, Stat } from '@/components/ui'
import { DepositStatusBadge, WithdrawalStatusBadge } from '@/components/status'
import { formatDateTime, formatRelative, formatUsdt, maskAddress } from '@/lib/format'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const { stats, pendingWithdrawals, pendingDeposits, recentUsers, recentActions } = await loadAdminOverview()

  if (!stats) {
    return (
      <Alert tone="negative" title="Statistics unavailable">
        The dashboard statistics function did not return data. Confirm the migrations have been applied and that your
        account has an ADMIN or SUPER_ADMIN role.
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations dashboard"
        description="Live platform state. All figures come from the internal ledger and the deposit/withdrawal tables."
      />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-muted">Needs attention</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Pending withdrawals"
            value={stats.pending_withdrawals}
            sub={`${formatUsdt(stats.pending_withdrawal_amount)} locked`}
            tone={stats.pending_withdrawals > 0 ? 'negative' : undefined}
          />
          <Stat label="Pending deposits" value={stats.pending_deposits} sub="Awaiting chain confirmation" />
          <Stat
            label="Total user liability"
            value={formatUsdt(stats.total_liability)}
            sub="Available plus locked, all users"
            tone="brand"
          />
          <Stat label="Suspended / banned" value={stats.suspended_users} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-muted">Today</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="New users" value={stats.new_users_today} />
          <Stat label="Tasks completed" value={stats.tasks_completed_today} />
          <Stat label="Task rewards issued" value={formatUsdt(stats.rewards_issued_today)} tone="positive" />
          <Stat label="Referral commission" value={formatUsdt(stats.referral_rewards_today)} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-muted">All time</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total users" value={stats.total_users} sub={`${stats.active_users} active`} />
          <Stat label="VIP users" value={stats.vip_users} />
          <Stat
            label="Deposits confirmed"
            value={stats.confirmed_deposits}
            sub={`${formatUsdt(stats.deposit_volume)} verified on chain`}
          />
          <Stat
            label="Withdrawals paid"
            value={stats.completed_withdrawals}
            sub={`${formatUsdt(stats.withdrawal_volume)} settled`}
          />
          <Stat label="Referral links" value={stats.total_referrals} sub={`${stats.referrals_today} today`} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Withdrawal queue</CardTitle>
            <Link href="/admin/withdrawals" className="text-sm text-brand hover:underline">
              Open queue
            </Link>
          </CardHeader>
          <CardBody className="pt-0">
            {pendingWithdrawals.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">Nothing waiting.</p>
            ) : (
              <ul className="divide-y divide-border">
                {pendingWithdrawals.map((w) => (
                  <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {formatUsdt(w.amount)} · {w.network_code}
                      </p>
                      <p className="truncate text-xs text-ink-subtle">
                        {w.user?.email ?? 'Unknown user'} → {maskAddress(w.destination_address)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <WithdrawalStatusBadge status={w.status} />
                      <span className="text-xs text-ink-subtle">{formatRelative(w.requested_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deposits awaiting confirmation</CardTitle>
            <Link href="/admin/deposits" className="text-sm text-brand hover:underline">
              All deposits
            </Link>
          </CardHeader>
          <CardBody className="pt-0">
            {pendingDeposits.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">Nothing pending.</p>
            ) : (
              <ul className="divide-y divide-border">
                {pendingDeposits.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {formatUsdt(d.amount)} declared · {d.network_code}
                      </p>
                      <p className="truncate text-xs text-ink-subtle">
                        {d.user?.email ?? 'Unknown user'} ·{' '}
                        {d.tx_hash ? `${d.confirmations}/${d.required_confirmations} confirmations` : 'no hash yet'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <DepositStatusBadge status={d.status} />
                      <span className="text-xs text-ink-subtle">{formatRelative(d.created_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Newest members</CardTitle>
            <Link href="/admin/users" className="text-sm text-brand hover:underline">
              All users
            </Link>
          </CardHeader>
          <CardBody className="pt-0">
            {recentUsers.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">No users yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentUsers.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/admin/users/${u.id}`} className="truncate text-sm font-medium hover:text-brand">
                        {u.username ?? u.email}
                      </Link>
                      <p className="truncate text-xs text-ink-subtle">
                        {u.email} · code {u.referral_code}
                      </p>
                    </div>
                    <Badge tone={u.status === 'ACTIVE' ? 'positive' : 'warning'}>{u.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent operator actions</CardTitle>
            <Link href="/admin/audit-logs" className="text-sm text-brand hover:underline">
              Audit log
            </Link>
          </CardHeader>
          <CardBody className="pt-0">
            {recentActions.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">No administrative actions recorded.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentActions.map((a) => (
                  <li key={a.id} className="py-2.5">
                    <p className="text-sm font-medium">{a.action}</p>
                    <p className="text-xs text-ink-subtle">
                      {a.admin?.email ?? 'system'} · {formatDateTime(a.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
