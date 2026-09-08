import type { Metadata } from 'next'
import Link from 'next/link'
import { firstParam, loadWithdrawals, pageParam } from '@/lib/admin/queries'
import { Alert, Card, CardBody, EmptyState, PageHeader } from '@/components/ui'
import { WithdrawalStatusBadge } from '@/components/status'
import { FilterTabs, Mono, Pagination } from '@/components/admin/controls'
import {
  ApproveWithdrawalButton,
  CopyValue,
  MarkPaidForm,
  RejectWithdrawalForm,
} from '@/components/admin/money-forms'
import { explorerUrl, formatDateTime, formatUsdt, shortHash } from '@/lib/format'
import { IconExternal } from '@/components/icons'

export const metadata: Metadata = { title: 'Withdrawals' }
export const dynamic = 'force-dynamic'

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Queue' },
  { value: undefined, label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'PAID', label: 'Paid' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export default async function AdminWithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  // Default view is the actionable queue rather than the full history.
  const status = 'status' in sp ? firstParam(sp.status) : 'OPEN'
  const page = pageParam(sp.page)

  const result = await loadWithdrawals({ status, page })
  const params = { status, page: String(page) }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Withdrawals"
        description="Payments are executed manually from an external wallet. The platform holds no private keys and never broadcasts a transaction."
      />

      <FilterTabs
        basePath="/admin/withdrawals"
        params={params}
        paramName="status"
        options={STATUS_OPTIONS}
        current={status}
      />

      {result.rows.length === 0 ? (
        <EmptyState title="Nothing here" description="No withdrawal matches this filter." />
      ) : (
        <div className="space-y-3">
          {result.rows.map((w) => {
            const link = explorerUrl(w.explorerTemplate, w.tx_hash)
            const actionable = w.status === 'PENDING' || w.status === 'PROCESSING'

            return (
              <Card key={w.id}>
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="tabular text-lg font-semibold">{formatUsdt(w.amount)}</p>
                        <WithdrawalStatusBadge status={w.status} />
                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium">
                          {w.network_code}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-subtle">
                        Requested {formatDateTime(w.requested_at)} · fee {formatUsdt(w.fee)} · net payout{' '}
                        <span className="font-semibold text-ink">{formatUsdt(w.net_amount)}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      {w.user ? (
                        <Link href={`/admin/users/${w.user.id}`} className="text-sm font-medium hover:text-brand">
                          {w.user.username ?? w.user.email}
                        </Link>
                      ) : (
                        <span className="text-sm text-ink-subtle">Unknown user</span>
                      )}
                      <p className="text-xs text-ink-subtle">{w.user?.email}</p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-surface-2 px-3 py-2.5">
                    <p className="text-xs uppercase tracking-wide text-ink-subtle">Destination address</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Mono>{w.destination_address}</Mono>
                      <CopyValue value={w.destination_address} />
                    </div>
                  </div>

                  {w.tx_hash ? (
                    <div className="rounded-lg bg-positive-soft px-3 py-2.5">
                      <p className="text-xs uppercase tracking-wide text-ink-subtle">Settlement transaction</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Mono>{w.tx_hash}</Mono>
                        {link ? (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
                          >
                            {shortHash(w.tx_hash)}
                            <IconExternal />
                          </a>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-ink-subtle">
                        Paid {formatDateTime(w.paid_at)}
                        {w.processedByUser ? ` by ${w.processedByUser.email}` : ''}
                      </p>
                    </div>
                  ) : null}

                  {w.rejection_reason ? (
                    <Alert tone="negative" title="Rejected">
                      {w.rejection_reason}
                    </Alert>
                  ) : null}

                  {w.admin_note ? <p className="text-xs text-ink-muted">Note: {w.admin_note}</p> : null}

                  {actionable ? (
                    <div className="flex flex-wrap items-start gap-2 border-t border-border pt-3">
                      {w.status === 'PENDING' ? <ApproveWithdrawalButton withdrawalId={w.id} /> : null}
                      <MarkPaidForm withdrawalId={w.id} amount={formatUsdt(w.net_amount)} />
                      <RejectWithdrawalForm withdrawalId={w.id} />
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      <Pagination basePath="/admin/withdrawals" params={params} page={result} />
    </div>
  )
}
