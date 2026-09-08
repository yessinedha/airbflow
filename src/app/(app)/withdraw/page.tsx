import type { Metadata } from 'next'
import { requireSession } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  Alert,
  Badge,
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
import { WithdrawalStatusBadge } from '@/components/status'
import { CancelWithdrawalButton, WithdrawForm, type WithdrawNetworkOption } from '@/components/withdraw-forms'
import { explorerUrl, formatDate, formatDateTime, formatUsdt, maskAddress, shortHash, toNumber } from '@/lib/format'
import { IconExternal } from '@/components/icons'
import type { SupportedNetwork, Withdrawal, WithdrawalEligibility } from '@/types/database'

export const metadata: Metadata = { title: 'Withdraw' }
export const dynamic = 'force-dynamic'

const REASON_COPY: Record<string, string> = {
  NO_ACTIVATION:
    'The waiting period is measured from your first VIP activation. Activate a plan to start the clock.',
  ACCOUNT_NOT_ACTIVE: 'Your account is not active. Contact support for details.',
  WITHDRAWAL_ALREADY_PENDING: 'You already have a withdrawal in progress. Only one can be open at a time.',
  COOLDOWN_ACTIVE: 'Your cooldown after the previous paid withdrawal has not finished yet.',
  FIRST_WITHDRAWAL_WAITING_PERIOD: 'Your first withdrawal has not unlocked yet.',
}

export default async function WithdrawPage() {
  const session = await requireSession('/withdraw')
  const supabase = await createSupabaseServerClient()

  const [{ data: eligibilityRaw }, { data: networks }, { data: withdrawals }] = await Promise.all([
    supabase.rpc('withdrawal_eligibility', { p_user_id: session.userId }),
    supabase
      .from('supported_networks')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .returns<SupportedNetwork[]>(),
    supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false })
      .limit(25)
      .returns<Withdrawal[]>(),
  ])

  const eligibility = eligibilityRaw as WithdrawalEligibility | null
  const networkByCode = new Map((networks ?? []).map((n) => [n.code, n]))

  const options: WithdrawNetworkOption[] = (networks ?? []).map((n) => ({
    code: n.code,
    name: n.name,
    minWithdrawal: toNumber(n.min_withdrawal),
    fee: toNumber(n.withdrawal_fee),
    enabled: n.withdrawal_enabled,
    addressHint: 'Double-check it: manual payments cannot be reversed.',
  }))

  const openWithdrawal = (withdrawals ?? []).find((w) => w.status === 'PENDING' || w.status === 'PROCESSING')
  const reason = eligibility?.reason ?? null
  const blocked = eligibility && !eligibility.eligible

  return (
    <div className="space-y-6">
      <PageHeader
        title="Withdraw"
        description="Withdrawals are paid manually by the operations team from an external wallet. The platform never holds a private key and never signs a transaction automatically."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Available" value={formatUsdt(session.profile.balance_available)} />
        <Stat
          label="Locked in requests"
          value={formatUsdt(session.profile.balance_pending_withdrawal)}
          tone={toNumber(session.profile.balance_pending_withdrawal) > 0 ? 'negative' : undefined}
        />
        <Stat label="Total withdrawn" value={formatUsdt(session.profile.total_withdrawn)} />
      </div>

      {eligibility ? (
        <Card>
          <CardHeader>
            <CardTitle>Withdrawal schedule</CardTitle>
            <Badge tone={eligibility.eligible ? 'positive' : 'warning'}>
              {eligibility.eligible ? 'Eligible now' : 'Not eligible yet'}
            </Badge>
          </CardHeader>
          <CardBody className="space-y-3 pt-0 text-sm">
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-subtle">First withdrawal</dt>
                <dd className="mt-0.5">{eligibility.first_withdrawal_wait_days} days after activation</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-subtle">Then</dt>
                <dd className="mt-0.5">once every {eligibility.withdrawal_cooldown_days} days</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-subtle">
                  {eligibility.is_first_withdrawal ? 'Unlocks on' : 'Next window'}
                </dt>
                <dd className="mt-0.5 font-medium">
                  {eligibility.eligible_at ? formatDate(eligibility.eligible_at) : 'Not started'}
                </dd>
              </div>
            </dl>

            {blocked && reason ? (
              <Alert tone="warning" title={reasonTitle(reason, eligibility)}>
                {REASON_COPY[reason] ?? 'You are not eligible to withdraw right now.'}
              </Alert>
            ) : null}

            <p className="text-xs text-ink-subtle">
              These rules are enforced by the server using its own clock. Changing your device time has no effect.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>New withdrawal request</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <WithdrawForm
              networks={options}
              available={toNumber(session.profile.balance_available)}
              disabledReason={
                blocked && reason
                  ? `${reasonTitle(reason, eligibility!)} ${REASON_COPY[reason] ?? ''}`.trim()
                  : null
              }
            />
          </CardBody>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>How settlement works</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 pt-0 text-sm text-ink-muted">
            <Step n={1} title="Request">
              The amount leaves your available balance immediately and is held as a pending withdrawal, so it cannot be
              spent twice.
            </Step>
            <Step n={2} title="Review">
              An operator reviews the request. If it is rejected, the full amount is returned to your available balance.
            </Step>
            <Step n={3} title="Manual payment">
              The operator sends the USDT from an external wallet, outside this application.
            </Step>
            <Step n={4} title="Recorded">
              The resulting transaction hash is recorded against your withdrawal and shown to you here, and the ledger is
              closed with a WITHDRAWAL_COMPLETED entry.
            </Step>
          </CardBody>
        </Card>
      </div>

      {openWithdrawal ? (
        <Card className="border-warning/40">
          <CardHeader>
            <CardTitle>Open request</CardTitle>
            <WithdrawalStatusBadge status={openWithdrawal.status} />
          </CardHeader>
          <CardBody className="space-y-3 pt-0 text-sm">
            <dl className="grid gap-3 sm:grid-cols-4">
              <Detail label="Amount" value={formatUsdt(openWithdrawal.amount)} />
              <Detail label="Fee" value={formatUsdt(openWithdrawal.fee)} />
              <Detail label="You receive" value={formatUsdt(openWithdrawal.net_amount)} />
              <Detail label="Requested" value={formatDateTime(openWithdrawal.requested_at)} />
              <Detail label="Network" value={openWithdrawal.network_code} />
              <Detail
                label="Destination"
                value={<span className="font-mono text-xs">{maskAddress(openWithdrawal.destination_address)}</span>}
                className="sm:col-span-3"
              />
            </dl>
            {openWithdrawal.status === 'PENDING' ? <CancelWithdrawalButton withdrawalId={openWithdrawal.id} /> : null}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Withdrawal history</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {!withdrawals?.length ? (
            <p className="py-6 text-center text-sm text-ink-muted">No withdrawals yet.</p>
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Requested</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>Network</Th>
                    <Th>Destination</Th>
                    <Th>Transaction</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => {
                    const url = explorerUrl(networkByCode.get(w.network_code)?.explorer_tx_url, w.tx_hash)
                    return (
                      <tr key={w.id}>
                        <Td className="whitespace-nowrap text-ink-muted">{formatDateTime(w.requested_at)}</Td>
                        <Td className="tabular text-right font-medium">{formatUsdt(w.amount)}</Td>
                        <Td>
                          <Badge>{w.network_code}</Badge>
                        </Td>
                        <Td className="font-mono text-xs">{maskAddress(w.destination_address)}</Td>
                        <Td>
                          {w.tx_hash ? (
                            url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-mono text-xs text-brand hover:underline"
                              >
                                {shortHash(w.tx_hash)}
                                <IconExternal />
                              </a>
                            ) : (
                              <span className="font-mono text-xs">{shortHash(w.tx_hash)}</span>
                            )
                          ) : (
                            <span className="text-xs text-ink-subtle">—</span>
                          )}
                        </Td>
                        <Td>
                          <WithdrawalStatusBadge status={w.status} />
                          {w.rejection_reason ? (
                            <p className="mt-0.5 max-w-48 text-xs text-negative">{w.rejection_reason}</p>
                          ) : null}
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function reasonTitle(reason: string, eligibility: WithdrawalEligibility): string {
  if (reason === 'FIRST_WITHDRAWAL_WAITING_PERIOD' || reason === 'COOLDOWN_ACTIVE') {
    const days = eligibility.days_remaining ?? 0
    return `Available in ${days} day${days === 1 ? '' : 's'}.`
  }
  return 'Withdrawal unavailable.'
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
        {n}
      </span>
      <div>
        <p className="font-medium text-ink">{title}</p>
        <p className="mt-0.5">{children}</p>
      </div>
    </div>
  )
}

function Detail({
  label,
  value,
  className,
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="text-xs uppercase tracking-wide text-ink-subtle">{label}</dt>
      <dd className="tabular mt-0.5 font-medium">{value}</dd>
    </div>
  )
}
