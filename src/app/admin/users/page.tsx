import type { Metadata } from 'next'
import Link from 'next/link'
import { firstParam, loadUsers, pageParam } from '@/lib/admin/queries'
import { Badge, Card, CardBody, EmptyState, PageHeader, Table, TableWrap, Td, Th } from '@/components/ui'
import { UserStatusBadge } from '@/components/status'
import { FilterTabs, Pagination, SearchBox } from '@/components/admin/controls'
import { formatDate, formatUsdt } from '@/lib/format'

export const metadata: Metadata = { title: 'Users' }
export const dynamic = 'force-dynamic'

const STATUS_OPTIONS = [
  { value: undefined, label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'BANNED', label: 'Banned' },
]

const ROLE_OPTIONS = [
  { value: undefined, label: 'Any role' },
  { value: 'USER', label: 'Users' },
  { value: 'ADMIN', label: 'Admins' },
  { value: 'SUPER_ADMIN', label: 'Super admins' },
]

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const q = firstParam(sp.q)
  const status = firstParam(sp.status)
  const role = firstParam(sp.role)
  const page = pageParam(sp.page)

  const result = await loadUsers({ q, status, role, page })
  const params = { q, status, role, page: String(page) }

  return (
    <div className="space-y-5">
      <PageHeader title="Users" description="Search by email, username or referral code." />

      <div className="space-y-3">
        <SearchBox basePath="/admin/users" params={params} placeholder="Email, username or code…" />
        <FilterTabs
          basePath="/admin/users"
          params={params}
          paramName="status"
          options={STATUS_OPTIONS}
          current={status}
        />
        <FilterTabs basePath="/admin/users" params={params} paramName="role" options={ROLE_OPTIONS} current={role} />
      </div>

      {result.rows.length === 0 ? (
        <EmptyState title="No users found" description="Try a different search term or filter." />
      ) : (
        <Card>
          <CardBody>
            <TableWrap>
              <Table className="min-w-[52rem]">
                <thead>
                  <tr>
                    <Th>User</Th>
                    <Th>Status</Th>
                    <Th>Role</Th>
                    <Th>Code</Th>
                    <Th className="text-right">Available</Th>
                    <Th className="text-right">Locked</Th>
                    <Th className="text-right">Rewards</Th>
                    <Th>Joined</Th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((u) => (
                    <tr key={u.id}>
                      <Td>
                        <Link href={`/admin/users/${u.id}`} className="font-medium hover:text-brand">
                          {u.username ?? u.email.split('@')[0]}
                        </Link>
                        <p className="text-xs text-ink-subtle">{u.email}</p>
                      </Td>
                      <Td>
                        <UserStatusBadge status={u.status} />
                      </Td>
                      <Td>
                        {u.role === 'USER' ? (
                          <span className="text-xs text-ink-subtle">USER</span>
                        ) : (
                          <Badge tone="brand">{u.role}</Badge>
                        )}
                      </Td>
                      <Td className="font-mono text-xs">{u.referral_code}</Td>
                      <Td className="tabular text-right">{formatUsdt(u.balance_available)}</Td>
                      <Td className="tabular text-right text-ink-muted">
                        {formatUsdt(u.balance_pending_withdrawal)}
                      </Td>
                      <Td className="tabular text-right text-ink-muted">{formatUsdt(u.total_rewards)}</Td>
                      <Td className="whitespace-nowrap text-xs text-ink-subtle">{formatDate(u.created_at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </CardBody>
        </Card>
      )}

      <Pagination basePath="/admin/users" params={params} page={result} />
    </div>
  )
}
