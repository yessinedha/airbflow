import type { Metadata } from 'next'
import Link from 'next/link'
import { firstParam, loadGlobalLedger, loadLedgerTotals, pageParam } from '@/lib/admin/queries'
import { Alert, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader, Table, TableWrap, Td, Th } from '@/components/ui'
import { LEDGER_LABELS, LedgerTypeBadge } from '@/components/status'
import { FilterTabs, Mono, Pagination } from '@/components/admin/controls'
import { formatDateTime, formatSignedUsdt, formatUsdt } from '@/lib/format'
import type { LedgerType } from '@/types/database'

export const metadata: Metadata = { title: 'Ledger' }
export const dynamic = 'force-dynamic'

const TYPES: LedgerType[] = [
  'DEPOSIT',
  'TASK_REWARD',
  'REFERRAL_REWARD',
  'VIP_ACTIVATION',
  'WITHDRAWAL_HOLD',
  'WITHDRAWAL_RELEASE',
  'WITHDRAWAL_COMPLETED',
  'ADMIN_ADJUSTMENT',
  'REFUND',
]

export default async function AdminLedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const type = firstParam(sp.type)
  const userId = firstParam(sp.userId)
  const page = pageParam(sp.page)

  const [result, totals] = await Promise.all([
    loadGlobalLedger({ type, userId, page }),
    loadLedgerTotals(),
  ])

  const params = { type, userId, page: String(page) }

  const options = [
    { value: undefined, label: 'All' },
    ...TYPES.map((t) => ({ value: t, label: LEDGER_LABELS[t] })),
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ledger"
        description="The append-only record of every balance change on the platform. Rows cannot be edited or deleted; corrections are posted as new entries."
      />

      <Alert tone="info" title="Immutability is enforced in the database">
        A trigger rejects any UPDATE or DELETE on this table, and balances can only move through the function that
        writes these rows, so the sum of a user&apos;s entries always equals their balance.
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Totals by movement type</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {totals.length === 0 ? (
            <p className="py-4 text-sm text-ink-muted">No entries yet.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {totals.map((t) => (
                <div key={t.type} className="rounded-lg bg-surface-2 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-ink-subtle">{LEDGER_LABELS[t.type]}</p>
                  <p className={`tabular font-semibold ${t.total >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {formatSignedUsdt(t.total)}
                  </p>
                  <p className="text-xs text-ink-subtle">{t.count} entries</p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="space-y-3">
        <FilterTabs basePath="/admin/ledger" params={params} paramName="type" options={options} current={type} />
        {userId ? (
          <p className="text-xs text-ink-subtle">
            Filtered to one user.{' '}
            <Link href="/admin/ledger" className="text-brand hover:underline">
              Clear filter
            </Link>
          </p>
        ) : null}
      </div>

      {result.rows.length === 0 ? (
        <EmptyState title="No ledger entries" description="Nothing matches this filter." />
      ) : (
        <Card>
          <CardBody>
            <TableWrap>
              <Table className="min-w-[56rem]">
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Date</Th>
                    <Th>User</Th>
                    <Th>Type</Th>
                    <Th>Description</Th>
                    <Th className="text-right">Amount</Th>
                    <Th className="text-right">Balance after</Th>
                    <Th>By</Th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((e) => (
                    <tr key={e.id}>
                      <Td className="tabular text-xs text-ink-subtle">{e.seq}</Td>
                      <Td className="whitespace-nowrap text-xs text-ink-muted">{formatDateTime(e.created_at)}</Td>
                      <Td>
                        {e.user ? (
                          <Link href={`/admin/users/${e.user.id}`} className="text-sm hover:text-brand">
                            {e.user.username ?? e.user.email}
                          </Link>
                        ) : (
                          <span className="text-sm text-ink-subtle">Unknown</span>
                        )}
                      </Td>
                      <Td>
                        <LedgerTypeBadge type={e.type} />
                      </Td>
                      <Td className="max-w-xs">
                        <p className="truncate text-xs text-ink-muted">{e.description ?? '—'}</p>
                        {e.reference_type ? (
                          <Mono className="text-ink-subtle">
                            {e.reference_type}:{e.reference_id?.slice(0, 8)}
                          </Mono>
                        ) : null}
                      </Td>
                      <Td
                        className={`tabular text-right font-semibold ${
                          Number(e.amount) >= 0 ? 'text-positive' : 'text-negative'
                        }`}
                      >
                        {formatSignedUsdt(e.amount)}
                      </Td>
                      <Td className="tabular text-right text-ink-muted">{formatUsdt(e.balance_after)}</Td>
                      <Td className="text-xs text-ink-subtle">{e.createdByUser?.email ?? 'system'}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </CardBody>
        </Card>
      )}

      <Pagination basePath="/admin/ledger" params={params} page={result} />
    </div>
  )
}
