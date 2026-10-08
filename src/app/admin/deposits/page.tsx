import type { Metadata } from 'next'
import Link from 'next/link'
import { firstParam, loadDeposits, pageParam } from '@/lib/admin/queries'
import { Alert, Card, CardBody, EmptyState, PageHeader } from '@/components/ui'
import { DepositStatusBadge } from '@/components/status'
import { FilterTabs, Mono, Pagination, SearchBox } from '@/components/admin/controls'
import {
  ApproveDepositProofForm,
  ConfirmDepositForm,
  RecheckDepositButton,
  RejectDepositForm,
} from '@/components/admin/money-forms'
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
        description="Deposits are credited after on-chain verification or documented manual review of a payment screenshot."
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
                        {d.verified_amount
                          ? d.payment_proof_path
                            ? ' · amount verified during manual review'
                            : ' · amount taken from the chain'
                          : ' · amount declared by the user'}
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

                  {d.payment_proof_path ? (
                    <div className="space-y-2 rounded-lg border border-border bg-surface-2 px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">Uploaded payment proof</p>
                        {d.proofUrl ? (
                          <a
                            href={d.proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-brand hover:underline"
                          >
                            View screenshot
                          </a>
                        ) : (
                          <span className="text-xs text-negative">Screenshot unavailable — check private Storage setup.</span>
                        )}
                      </div>
                      {d.proof_ocr_data ? (
                        <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                          <div>
                            <dt className="text-ink-subtle">OCR amount (unverified)</dt>
                            <dd>{d.proof_ocr_data.amount} {d.currency}</dd>
                          </div>
                          <div>
                            <dt className="text-ink-subtle">OCR network / status</dt>
                            <dd>{d.proof_ocr_data.network} · {d.proof_ocr_data.status}</dd>
                          </div>
                          <div>
                            <dt className="text-ink-subtle">OCR date</dt>
                            <dd>{d.proof_ocr_data.date}</dd>
                          </div>
                          <div>
                            <dt className="text-ink-subtle">OCR destination matched</dt>
                            <dd>
                              {d.proof_ocr_data.addressMatch === 'approximate'
                                ? 'Approximate match (OCR only; verify screenshot)'
                                : d.proof_ocr_data.addressMatched
                                  ? 'Exact match (OCR only)'
                                  : 'No match'}
                            </dd>
                          </div>
                        </dl>
                      ) : null}
                      {d.proof_ocr_data?.binanceTransferId ? (
                        <p className="break-all text-xs">
                          <span className="text-ink-subtle">Binance transfer reference (not an on-chain TXID; unverified): </span>
                          <Mono>{d.proof_ocr_data.binanceTransferId}</Mono>
                        </p>
                      ) : null}
                      {d.proof_ocr_data?.txHash ? (
                        <p className="break-all text-xs">
                          <span className="text-ink-subtle">OCR on-chain TXID (unverified): </span>
                          {explorerUrl(d.explorerTemplate, d.proof_ocr_data.txHash) ? (
                            <a
                              href={explorerUrl(d.explorerTemplate, d.proof_ocr_data.txHash) ?? undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-brand hover:underline"
                            >
                              {d.proof_ocr_data.txHash}
                              <IconExternal />
                            </a>
                          ) : (
                            <Mono>{d.proof_ocr_data.txHash}</Mono>
                          )}
                        </p>
                      ) : null}
                      {d.proof_ocr_data?.rawText ? (
                        <details>
                          <summary className="cursor-pointer text-xs text-ink-muted">Untrusted OCR text</summary>
                          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-surface px-2 py-2 text-xs">
                            {d.proof_ocr_data.rawText}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  ) : null}

                  {amountDiffers ? (
                    <Alert tone="warning" title="Verified amount differs from the declared amount">
                      Declared {formatUsdt(d.amount)}, credited {formatUsdt(d.verified_amount)}.{' '}
                      {d.payment_proof_path
                        ? 'The manually verified amount is what the user received.'
                        : 'The chain is authoritative, so the credited figure is what the user received.'}
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
                      {d.payment_proof_path ? (
                        d.proofUrl ? (
                          <ApproveDepositProofForm depositId={d.id} declaredAmount={String(d.amount)} />
                        ) : (
                          <Alert tone="negative">Approval disabled because the private screenshot could not be opened.</Alert>
                        )
                      ) : (
                        <ConfirmDepositForm depositId={d.id} declaredAmount={String(d.amount)} />
                      )}
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
