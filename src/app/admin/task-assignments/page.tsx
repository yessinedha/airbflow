import type { Metadata } from 'next'
import Link from 'next/link'
import { firstParam, loadAssignments, pageParam } from '@/lib/admin/queries'
import { Card, CardBody, EmptyState, PageHeader, Table, TableWrap, Td, Th } from '@/components/ui'
import { AssignmentStatusBadge } from '@/components/status'
import { FilterTabs, Pagination } from '@/components/admin/controls'
import { formatDateTime, formatUsdt } from '@/lib/format'
import { utcToday } from '@/lib/dashboard/queries'

export const metadata: Metadata = { title: 'Task assignments' }
export const dynamic = 'force-dynamic'

const STATUS_OPTIONS = [
  { value: undefined, label: 'All' },
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'STARTED', label: 'Started' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'EXPIRED', label: 'Expired' },
]

export default async function AdminAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const status = firstParam(sp.status)
  const userId = firstParam(sp.userId)
  const date = firstParam(sp.date)
  const page = pageParam(sp.page)

  const result = await loadAssignments({ status, userId, date, page })
  const params = { status, userId, date, page: String(page) }
  const today = utcToday()

  const dateOptions = [
    { value: undefined, label: 'All dates' },
    { value: today, label: 'Today (UTC)' },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Task assignments"
        description="Every task issued, started and claimed. The daily cycle is keyed on the UTC date, and the three-minute timer is validated against the server clock at claim time."
      />

      <div className="space-y-3">
        <FilterTabs
          basePath="/admin/task-assignments"
          params={params}
          paramName="status"
          options={STATUS_OPTIONS}
          current={status}
        />
        <FilterTabs
          basePath="/admin/task-assignments"
          params={params}
          paramName="date"
          options={dateOptions}
          current={date}
        />
        {userId ? (
          <p className="text-xs text-ink-subtle">
            Filtered to one user.{' '}
            <Link href="/admin/task-assignments" className="text-brand hover:underline">
              Clear filter
            </Link>
          </p>
        ) : null}
      </div>

      {result.rows.length === 0 ? (
        <EmptyState title="No assignments" description="Nothing matches this filter." />
      ) : (
        <Card>
          <CardBody>
            <TableWrap>
              <Table className="min-w-[52rem]">
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>User</Th>
                    <Th>Slot</Th>
                    <Th>Task</Th>
                    <Th>Status</Th>
                    <Th>Started</Th>
                    <Th>Completed</Th>
                    <Th className="text-right">Reward</Th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((a) => (
                    <tr key={a.id}>
                      <Td className="whitespace-nowrap text-xs text-ink-muted">{a.assigned_date}</Td>
                      <Td>
                        {a.user ? (
                          <Link href={`/admin/users/${a.user.id}`} className="text-sm hover:text-brand">
                            {a.user.username ?? a.user.email}
                          </Link>
                        ) : (
                          <span className="text-sm text-ink-subtle">Unknown</span>
                        )}
                      </Td>
                      <Td className="text-xs">{a.slot}</Td>
                      <Td className="max-w-xs truncate">{a.taskTitle}</Td>
                      <Td>
                        <AssignmentStatusBadge status={a.status} />
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-ink-subtle">
                        {a.started_at ? formatDateTime(a.started_at) : '—'}
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-ink-subtle">
                        {a.completed_at ? formatDateTime(a.completed_at) : '—'}
                      </Td>
                      <Td className="tabular text-right">{formatUsdt(a.reward_amount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </CardBody>
        </Card>
      )}

      <Pagination basePath="/admin/task-assignments" params={params} page={result} />
    </div>
  )
}
