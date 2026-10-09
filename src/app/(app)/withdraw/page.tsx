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
import { getT } from '@/lib/i18n/server'
import type { Dictionary } from '@/lib/i18n/dictionaries'

export const metadata: Metadata = { title: 'Withdraw' }
export const dynamic = 'force-dynamic'

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

  const t = await getT()
  const reasonCopy = t.withdraw.reasons as Record<string, string>
  const eligibility = eligibilityRaw as WithdrawalEligibility | null
  const networkByCode = new Map((networks ?? []).map((n) => [n.code, n]))

  const options: WithdrawNetworkOption[] = (networks ?? []).map((n) => ({
    code: n.code,
    name: n.name,
    minWithdrawal: toNumber(n.min_withdrawal),
    fee: toNumber(n.withdrawal_fee),
    enabled: n.withdrawal_enabled,
    addressHint: t.withdraw.form.destinationHint,
  }))
  const vipWithdrawalFee = session.vipPlan && session.vipPlan.level <= 7
    ? toNumber(session.vipPlan.withdrawal_fee)
    : 0

  const openWithdrawal = (withdrawals ?? []).find((w) => w.status === 'PENDING' || w.status === 'PROCESSING')
  const reason = eligibility?.reason ?? null
  const blocked = eligibility && !eligibility.eligible

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.withdraw.title}
        description={t.withdraw.description}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={t.withdraw.available} value={formatUsdt(session.profile.balance_available)} />
        <Stat
          label={t.withdraw.lockedInRequests}
          value={formatUsdt(session.profile.balance_pending_withdrawal)}
          tone={toNumber(session.profile.balance_pending_withdrawal) > 0 ? 'negative' : undefined}
        />
        <Stat label={t.withdraw.totalWithdrawn} value={formatUsdt(session.profile.total_withdrawn)} />
      </div>

      {eligibility ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.withdraw.scheduleTitle}</CardTitle>
            <Badge tone={eligibility.eligible ? 'positive' : 'warning'}>
              {eligibility.eligible ? t.withdraw.eligibleNow : t.withdraw.notEligible}
            </Badge>
          </CardHeader>
          <CardBody className="space-y-3 pt-0 text-sm">
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="label-mono text-ink-subtle">{t.withdraw.firstWithdrawal}</dt>
                <dd className="mt-0.5">
                  {t.withdraw.daysAfterActivation(eligibility.first_withdrawal_wait_days ?? 0)}
                </dd>
              </div>
              <div>
                <dt className="label-mono text-ink-subtle">{t.withdraw.then}</dt>
                <dd className="mt-0.5">{t.withdraw.onceEvery(eligibility.withdrawal_cooldown_days ?? 0)}</dd>
              </div>
              <div>
                <dt className="label-mono text-ink-subtle">
                  {eligibility.is_first_withdrawal ? t.withdraw.unlocksOn : t.withdraw.nextWindow}
                </dt>
                <dd className="mt-0.5 font-medium">
                  {eligibility.eligible_at ? formatDate(eligibility.eligible_at) : t.withdraw.notStarted}
                </dd>
              </div>
            </dl>

            {blocked && reason ? (
              <Alert tone="warning" title={reasonTitle(reason, eligibility, t)}>
                {reasonCopy[reason] ?? t.withdraw.reasons.GENERIC}
              </Alert>
            ) : null}

            <p className="text-xs text-ink-subtle">{t.withdraw.serverClockNote}</p>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{t.withdraw.newRequest}</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <WithdrawForm
              networks={options}
              available={toNumber(session.profile.balance_available)}
              platformFee={vipWithdrawalFee}
              disabledReason={
                blocked && reason
                  ? `${reasonTitle(reason, eligibility!, t)} ${reasonCopy[reason] ?? ''}`.trim()
                  : null
              }
            />
          </CardBody>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{t.withdraw.settlementTitle}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 pt-0 text-sm text-ink-muted">
            {t.withdraw.settlementSteps.map((step, index) => (
              <Step key={step.title} n={index + 1} title={step.title}>
                {step.body}
              </Step>
            ))}
          </CardBody>
        </Card>
      </div>

      {openWithdrawal ? (
        <Card className="border-warning/40">
          <CardHeader>
            <CardTitle>{t.withdraw.openRequest}</CardTitle>
            <WithdrawalStatusBadge
              status={openWithdrawal.status}
              label={t.statuses.withdrawal[openWithdrawal.status]}
            />
          </CardHeader>
          <CardBody className="space-y-3 pt-0 text-sm">
            <dl className="grid gap-3 sm:grid-cols-4">
              <Detail label={t.common.amount} value={formatUsdt(openWithdrawal.amount)} />
              <Detail label={t.withdraw.fee} value={formatUsdt(openWithdrawal.fee)} />
              <Detail label={t.withdraw.form.youReceive} value={formatUsdt(openWithdrawal.net_amount)} />
              <Detail label={t.withdraw.requested} value={formatDateTime(openWithdrawal.requested_at)} />
              <Detail label={t.withdraw.form.network} value={openWithdrawal.network_code} />
              <Detail
                label={t.withdraw.destination}
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
          <CardTitle>{t.withdraw.historyTitle}</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {!withdrawals?.length ? (
            <p className="py-6 text-center text-sm text-ink-muted">{t.withdraw.noWithdrawals}</p>
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>{t.withdraw.requested}</Th>
                    <Th className="text-end">{t.common.amount}</Th>
                    <Th>{t.withdraw.form.network}</Th>
                    <Th>{t.withdraw.destination}</Th>
                    <Th>{t.deposit.transaction}</Th>
                    <Th>{t.common.status}</Th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => {
                    const url = explorerUrl(networkByCode.get(w.network_code)?.explorer_tx_url, w.tx_hash)
                    return (
                      <tr key={w.id}>
                        <Td className="whitespace-nowrap text-ink-muted">{formatDateTime(w.requested_at)}</Td>
                        <Td className="tabular text-end font-medium">{formatUsdt(w.amount)}</Td>
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
                            <span className="text-xs text-ink-subtle">{t.common.dash}</span>
                          )}
                        </Td>
                        <Td>
                          <WithdrawalStatusBadge status={w.status} label={t.statuses.withdrawal[w.status]} />
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

function reasonTitle(reason: string, eligibility: WithdrawalEligibility, t: Dictionary): string {
  if (reason === 'FIRST_WITHDRAWAL_WAITING_PERIOD' || reason === 'COOLDOWN_ACTIVE') {
    return t.withdraw.availableInDays(eligibility.days_remaining ?? 0)
  }
  return t.withdraw.unavailable
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
