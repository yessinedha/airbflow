import type { Metadata } from 'next'
import Link from 'next/link'
import { firstParam, loadAuditActionNames, loadAuditLogs, pageParam } from '@/lib/admin/queries'
import { Alert, Card, CardBody, EmptyState, PageHeader } from '@/components/ui'
import { FilterTabs, Mono, Pagination } from '@/components/admin/controls'
import { formatDateTime } from '@/lib/format'

export const metadata: Metadata = { title: 'Audit logs' }
export const dynamic = 'force-dynamic'

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const action = firstParam(sp.action)
  const page = pageParam(sp.page)

  const [result, names] = await Promise.all([loadAuditLogs({ action, page }), loadAuditActionNames()])
  const params = { action, page: String(page) }

  const options = [{ value: undefined, label: 'All actions' }, ...names.map((n) => ({ value: n, label: n }))]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit logs"
        description="Every privileged action, written by the database function that performed it rather than by the caller."
      />

      <Alert tone="info" title="Written inside the same transaction">
        Audit rows are inserted by the SECURITY DEFINER functions themselves, so an action either happens together with
        its log entry or not at all. The table is readable by administrators and writable by nobody.
      </Alert>

      <FilterTabs basePath="/admin/audit-logs" params={params} paramName="action" options={options} current={action} />

      {result.rows.length === 0 ? (
        <EmptyState title="No entries" description="No administrative action has been recorded yet." />
      ) : (
        <div className="space-y-2">
          {result.rows.map((entry) => (
            <Card key={entry.id}>
              <CardBody className="space-y-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-sm font-semibold">{entry.action}</p>
                  <p className="text-xs text-ink-subtle">{formatDateTime(entry.created_at)}</p>
                </div>

                <p className="text-xs text-ink-muted">
                  By{' '}
                  {entry.admin ? (
                    <Link href={`/admin/users/${entry.admin.id}`} className="text-brand hover:underline">
                      {entry.admin.email}
                    </Link>
                  ) : (
                    'system'
                  )}
                  {entry.target_type ? (
                    <>
                      {' · target '}
                      <Mono>
                        {entry.target_type}
                        {entry.target_id ? `:${entry.target_id.slice(0, 8)}` : ''}
                      </Mono>
                    </>
                  ) : null}
                </p>

                {Object.keys(entry.payload ?? {}).length > 0 ? (
                  <pre className="scrollbar-thin overflow-x-auto rounded-lg bg-surface-2 px-3 py-2 text-xs">
                    {JSON.stringify(entry.payload, null, 2)}
                  </pre>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Pagination basePath="/admin/audit-logs" params={params} page={result} />
    </div>
  )
}
