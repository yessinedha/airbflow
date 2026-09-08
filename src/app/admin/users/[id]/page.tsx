import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadUserDetail } from '@/lib/admin/queries'
import { requireAdminSession } from '@/lib/auth/session'
import {
  Alert,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageHeader,
  Stat,
  Table,
  TableWrap,
  Td,
  Th,
} from '@/components/ui'
import {
  AssignmentStatusBadge,
  DepositStatusBadge,
  LedgerTypeBadge,
  UserStatusBadge,
  WithdrawalStatusBadge,
} from '@/components/status'
import { DetailRow, Mono } from '@/components/admin/controls'
import { AdjustBalanceForm, SetUserRoleForm, SetUserStatusForm } from '@/components/admin/user-forms'
import { formatDate, formatDateTime, formatSignedUsdt, formatUsdt, shortHash } from '@/lib/format'

export const metadata: Metadata = { title: 'User' }
export const dynamic = 'force-dynamic'

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireAdminSession()
  const detail = await loadUserDetail(id)

  if (!detail) notFound()

  const { profile, vipPlan, referrer, vipHistory, ledger, deposits, withdrawals, assignments, eligibility } = detail
  const isSuperAdmin = session.profile.role === 'SUPER_ADMIN'
  const isSelf = profile.id === session.userId

  return (
    <div className="space-y-5">
      <PageHeader
        title={profile.username ?? profile.email}
        description={profile.email}
        actions={
          <>
            <ButtonLink href="/admin/users" variant="secondary" size="sm">
              Back to users
            </ButtonLink>
            <ButtonLink href={`/admin/ledger?userId=${profile.id}`} variant="secondary" size="sm">
              Full ledger
            </ButtonLink>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <UserStatusBadge status={profile.status} />
        {profile.role !== 'USER' ? <Badge tone="brand">{profile.role}</Badge> : null}
        {vipPlan ? <Badge tone="positive">{vipPlan.name}</Badge> : <Badge>No VIP plan</Badge>}
        {isSelf ? <Badge tone="warning">This is your own account</Badge> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Available balance" value={formatUsdt(profile.balance_available)} tone="brand" />
        <Stat
          label="Locked for withdrawal"
          value={formatUsdt(profile.balance_pending_withdrawal)}
          tone={Number(profile.balance_pending_withdrawal) > 0 ? 'negative' : undefined}
        />
        <Stat label="Total deposited" value={formatUsdt(profile.total_deposited)} sub="Chain verified" />
        <Stat label="Total withdrawn" value={formatUsdt(profile.total_withdrawn)} />
        <Stat label="Task rewards" value={formatUsdt(detail.totals.taskRewards)} />
        <Stat label="Referral commission" value={formatUsdt(detail.totals.referralRewards)} />
        <Stat
          label="Team"
          value={detail.referralLevels.reduce((n, l) => n + l.count, 0)}
          sub={detail.referralLevels.map((l) => `L${l.level}: ${l.count}`).join(' · ')}
        />
        <Stat label="Tasks recorded" value={assignments.length} sub="Most recent 30" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <DetailRow label="User ID">
              <Mono>{profile.id}</Mono>
            </DetailRow>
            <DetailRow label="Referral code">
              <Mono>{profile.referral_code}</Mono>
            </DetailRow>
            <DetailRow label="Invited by">
              {referrer ? (
                <Link href={`/admin/users/${referrer.id}`} className="text-brand hover:underline">
                  {referrer.username ?? referrer.email}
                </Link>
              ) : (
                <span className="text-ink-subtle">Root account</span>
              )}
            </DetailRow>
            <DetailRow label="Registered">{formatDateTime(profile.created_at)}</DetailRow>
            <DetailRow label="First activation">
              {profile.first_activation_at ? formatDateTime(profile.first_activation_at) : '—'}
            </DetailRow>
            <DetailRow label="Last withdrawal">
              {profile.last_withdrawal_at ? formatDateTime(profile.last_withdrawal_at) : 'Never'}
            </DetailRow>
            <DetailRow label="Two-factor">{profile.two_factor_enabled ? 'Enabled' : 'Not enabled'}</DetailRow>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Withdrawal eligibility</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            {eligibility ? (
              <>
                <DetailRow label="Eligible now">
                  {eligibility.eligible ? (
                    <Badge tone="positive">Yes</Badge>
                  ) : (
                    <Badge tone="warning">{eligibility.reason ?? 'No'}</Badge>
                  )}
                </DetailRow>
                <DetailRow label="First withdrawal">
                  {eligibility.is_first_withdrawal ? 'Not taken yet' : 'Already taken'}
                </DetailRow>
                <DetailRow label="Waiting period">{eligibility.first_withdrawal_wait_days} days</DetailRow>
                <DetailRow label="Cooldown">{eligibility.withdrawal_cooldown_days} days</DetailRow>
                <DetailRow label="Eligible from">
                  {eligibility.eligible_at ? formatDateTime(eligibility.eligible_at) : '—'}
                </DetailRow>
                <DetailRow label="Days remaining">{eligibility.days_remaining ?? 0}</DetailRow>
                <DetailRow label="Open requests">{eligibility.open_withdrawals}</DetailRow>
              </>
            ) : (
              <p className="py-4 text-sm text-ink-muted">Eligibility could not be evaluated.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operator actions</CardTitle>
          <p className="text-xs text-ink-subtle">Every action here is written to the audit log.</p>
        </CardHeader>
        <CardBody className="flex flex-wrap items-start gap-2 pt-0">
          <AdjustBalanceForm
            key={profile.balance_available}
            userId={profile.id}
            currentBalance={profile.balance_available}
          />
          {isSelf ? (
            <Alert tone="neutral">You cannot change the status or role of your own account.</Alert>
          ) : (
            <>
              <SetUserStatusForm userId={profile.id} current={profile.status} />
              {isSuperAdmin ? <SetUserRoleForm userId={profile.id} current={profile.role} /> : null}
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>VIP history</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {vipHistory.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">No VIP activation recorded.</p>
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Activated</Th>
                    <Th>From</Th>
                    <Th>To</Th>
                    <Th className="text-right">Charged</Th>
                    <Th className="text-right">New capital</Th>
                  </tr>
                </thead>
                <tbody>
                  {vipHistory.map((h) => (
                    <tr key={h.id}>
                      <Td className="whitespace-nowrap text-ink-muted">{formatDateTime(h.activated_at)}</Td>
                      <Td>{h.previousPlanName ?? '—'}</Td>
                      <Td className="font-medium">{h.planName}</Td>
                      <Td className="tabular text-right">{formatUsdt(h.amount_charged)}</Td>
                      <Td className="tabular text-right text-ink-muted">{formatUsdt(h.new_capital)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Deposits</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            {deposits.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">No deposits.</p>
            ) : (
              <TableWrap>
                <Table className="min-w-0">
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Amount</Th>
                      <Th>Network</Th>
                      <Th>Status</Th>
                      <Th>Hash</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {deposits.map((d) => (
                      <tr key={d.id}>
                        <Td className="whitespace-nowrap text-xs text-ink-muted">{formatDate(d.created_at)}</Td>
                        <Td className="tabular">{formatUsdt(d.verified_amount ?? d.amount)}</Td>
                        <Td className="text-xs">{d.network_code}</Td>
                        <Td>
                          <DepositStatusBadge status={d.status} />
                        </Td>
                        <Td className="font-mono text-xs">{shortHash(d.tx_hash, 6, 4)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Withdrawals</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            {withdrawals.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">No withdrawals.</p>
            ) : (
              <TableWrap>
                <Table className="min-w-0">
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Amount</Th>
                      <Th>Network</Th>
                      <Th>Status</Th>
                      <Th>Hash</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map((w) => (
                      <tr key={w.id}>
                        <Td className="whitespace-nowrap text-xs text-ink-muted">{formatDate(w.requested_at)}</Td>
                        <Td className="tabular">{formatUsdt(w.amount)}</Td>
                        <Td className="text-xs">{w.network_code}</Td>
                        <Td>
                          <WithdrawalStatusBadge status={w.status} />
                        </Td>
                        <Td className="font-mono text-xs">{shortHash(w.tx_hash, 6, 4)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent ledger movements</CardTitle>
          <Link href={`/admin/ledger?userId=${profile.id}`} className="text-sm text-brand hover:underline">
            Full ledger
          </Link>
        </CardHeader>
        <CardBody className="pt-0">
          {ledger.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">No ledger entries.</p>
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Type</Th>
                    <Th>Description</Th>
                    <Th className="text-right">Amount</Th>
                    <Th className="text-right">Balance after</Th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((e) => (
                    <tr key={e.id}>
                      <Td className="whitespace-nowrap text-xs text-ink-muted">{formatDateTime(e.created_at)}</Td>
                      <Td>
                        <LedgerTypeBadge type={e.type} />
                      </Td>
                      <Td className="max-w-xs truncate text-xs text-ink-muted">{e.description ?? '—'}</Td>
                      <Td
                        className={`tabular text-right font-semibold ${
                          Number(e.amount) >= 0 ? 'text-positive' : 'text-negative'
                        }`}
                      >
                        {formatSignedUsdt(e.amount)}
                      </Td>
                      <Td className="tabular text-right text-ink-muted">{formatUsdt(e.balance_after)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent task assignments</CardTitle>
          <Link href={`/admin/task-assignments?userId=${profile.id}`} className="text-sm text-brand hover:underline">
            All assignments
          </Link>
        </CardHeader>
        <CardBody className="pt-0">
          {assignments.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">No assignments yet.</p>
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Slot</Th>
                    <Th>Task</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Reward</Th>
                    <Th>Completed</Th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id}>
                      <Td className="whitespace-nowrap text-xs text-ink-muted">{a.assigned_date}</Td>
                      <Td className="text-xs">{a.slot}</Td>
                      <Td className="max-w-xs truncate">{a.taskTitle}</Td>
                      <Td>
                        <AssignmentStatusBadge status={a.status} />
                      </Td>
                      <Td className="tabular text-right">{formatUsdt(a.reward_amount)}</Td>
                      <Td className="whitespace-nowrap text-xs text-ink-subtle">
                        {a.completed_at ? formatDateTime(a.completed_at) : '—'}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Direct referrals</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {detail.directReferrals.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">This user has not invited anyone.</p>
          ) : (
            <ul className="divide-y divide-border">
              {detail.directReferrals.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <Link href={`/admin/users/${r.id}`} className="text-sm font-medium hover:text-brand">
                    {r.username ?? r.email}
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-ink-subtle">
                    <span className="font-mono">{r.referral_code}</span>
                    <UserStatusBadge status={r.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
