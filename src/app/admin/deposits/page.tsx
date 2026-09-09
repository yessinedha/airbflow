import type { Metadata } from 'next'
import Link from 'next/link'
import { firstParam, loadDeposits, pageParam } from '@/lib/admin/queries'
import { Alert, Card, CardBody, EmptyState, PageHeader } from '@/components/ui'
import { DepositStatusBadge } from '@/components/status'
import { FilterTabs, Mono, Pagination, SearchBox } from '@/components/admin/controls'
import { ConfirmDepositForm, RecheckDepositButton, RejectDepositForm } from '@/components/admin/money-forms'
import { explorerUrl, formatDateTime, formatUsdt, shortHash } from '@/lib/format'
import { IconExternal } from '@/components/icons'

export const metadata: Metadata = { title: 'Deposits' }
export const dynamic = 'force-dynamic'

const STATUS_OPTIONS = [
  { value: undefined, label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'REJECTED', label: 'Rejected' },
]

export default async function AdminDepositsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const status = firstParam(sp.status)
  const q = firstParam(sp.q)
  const page = pageParam(sp.page)

  const result = await loadDeposits({ status, q, page })
  const params = { status, q, page: String(page) }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Deposits"
        description="Deposits are credited only by on-chain verification. Manual confirmation is an audited exception path."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          basePath="/admin/deposits"
          params={params}
          paramName="status"
          options={STATUS_OPTIONS}
          current={status}
        />
        <SearchBox basePath="/admin/deposits" params={params} placeholder="Transaction hash or reference…" />
      </div>

      {result.rows.length === 0 ? (
        <EmptyState title="No deposits" description="Nothing matches this filter." />
      ) : (
        <div className="space-y-3">
          {result.rows.map((d) => {
            const link = explorerUrl(d.explorerTemplate, d.tx_hash)
            const amountDiffers =
              d.verified_amount !== null && Number(d.verified_amount) !== Number(d.amount)

            return (
              <Card key={d.id}>
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="tabular text-lg font-semibold">
                          {d.verified_amount ? formatUsdt(d.verified_amount) : formatUsdt(d.amount)}
                        </p>
                        <DepositStatusBadge status={d.status} />
                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium">
                          {d.network_code}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-subtle">
                        Created {formatDateTime(d.created_at)} · reference <Mono>{d.reference_code}</Mono>
                        {d.verified_amount ? ' · amount taken from the chain' : ' · amount declared by the user'}
                      </p>
                    </div>

                    <div className="text-end">
                      {d.user ? (
                        <Link href={`/admin/users/${d.user.id}`} className="text-sm font-medium hover:text-brand">
                          {d.user.username ?? d.user.email}
                        </Link>
                      ) : (
                        <span className="text-sm text-ink-subtle">Unknown user</span>
                      )}
                      <p className="text-xs text-ink-subtle">{d.user?.email}</p>
                    </div>
                  </div>

                  {amountDiffers ? (
                    <Alert tone="warning" title="Verified amount differs from the declared amount">
                      Declared {formatUsdt(d.amount)}, credited {formatUsdt(d.verified_amount)}. The chain is
                      authoritative, so the credited figure is what the user received.
                    </Alert>
                  ) : null}

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg bg-surface-2 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-ink-subtle">Transaction</p>
                      {d.tx_hash ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Mono>{shortHash(d.tx_hash, 14, 10)}</Mono>
                          {link ? (
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
                            >
                              Explorer
                              <IconExternal />
                            </a>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-sm text-ink-muted">Not submitted yet</p>
                      )}
                      <p className="mt-1 text-xs text-ink-subtle">
                        {d.confirmations}/{d.required_confirmations} confirmations
                        {d.last_checked_at ? ` · checked ${formatDateTime(d.last_checked_at)}` : ''}
                        {d.verification_attempts ? ` · ${d.verification_attempts} attempt(s)` : ''}
                      </p>
                    </div>

                    <div className="rounded-lg bg-surface-2 px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-ink-subtle">Addresses</p>
                      <p className="text-xs">
                        From: <Mono>{d.from_address ?? '—'}</Mono>
                      </p>
                      <p className="text-xs">
                        To: <Mono>{d.to_address ?? '—'}</Mono>
                      </p>
                      {d.confirmed_at ? (
                        <p className="mt-1 text-xs text-ink-subtle">Confirmed {formatDateTime(d.confirmed_at)}</p>
                      ) : null}
                    </div>
                  </div>

                  {d.rejection_reason ? (
                    <Alert tone="negative" title="Rejected">
                      {d.rejection_reason}
                    </Alert>
                  ) : null}

                  {d.status === 'PENDING' ? (
                    <div className="flex flex-wrap items-start gap-2 border-t border-border pt-3">
                      {d.tx_hash ? <RecheckDepositButton depositId={d.id} /> : null}
                      <ConfirmDepositForm depositId={d.id} declaredAmount={String(d.amount)} />
                      <RejectDepositForm depositId={d.id} />
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      <Pagination basePath="/admin/deposits" params={params} page={result} />
    </div>
  )
}
