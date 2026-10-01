import type { Metadata } from 'next'
import Link from 'next/link'
import { firstParam, loadReferrals, loadTopReferrers, pageParam } from '@/lib/admin/queries'
import { Alert, Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader, Table, TableWrap, Td, Th } from '@/components/ui'
import { FilterTabs, Pagination } from '@/components/admin/controls'
import { formatDateTime, formatUsdt } from '@/lib/format'

export const metadata: Metadata = { title: 'Referrals' }
export const dynamic = 'force-dynamic'

const LEVEL_OPTIONS = [
  { value: undefined, label: 'All levels' },
  { value: '1', label: 'Level 1' },
  { value: '2', label: 'Level 2' },
  { value: '3', label: 'Level 3' },
]

export default async function AdminReferralsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const level = firstParam(sp.level)
  const page = pageParam(sp.page)

  const [result, top] = await Promise.all([loadReferrals({ level, page }), loadTopReferrers(10)])
  const params = { level, page: String(page) }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Referrals"
        description="The materialised ancestor chain. Each user has at most one referrer per level, fixed at registration and immutable afterwards."
      />

      <Alert tone="info" title="Commission comes out of revenue the platform collected">
        When a team member activates a VIP plan included in the referral programme, a configured percentage of that
        activation fee is credited to their upline, up to three levels. Nothing is paid out of another member&apos;s
        deposit and deposits alone generate no commission. The eligible plans and percentages live in Settings.
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Largest teams</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {top.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">No referral relationships yet.</p>
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Member</Th>
                    <Th className="text-end">Direct</Th>
                    <Th className="text-end">Team (3 levels)</Th>
                    <Th className="text-end">Commission earned</Th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((row, index) => (
                    <tr key={row.user?.id ?? `unknown-${index}`}>
                      <Td>
                        {row.user ? (
                          <Link href={`/admin/users/${row.user.id}`} className="text-sm font-medium hover:text-brand">
                            {row.user.username ?? row.user.email}
                          </Link>
                        ) : (
                          <span className="text-sm text-ink-subtle">Unknown</span>
                        )}
                        {row.user ? <p className="font-mono text-xs text-ink-subtle">{row.user.referral_code}</p> : null}
                      </Td>
                      <Td className="tabular text-end">{row.directCount}</Td>
                      <Td className="tabular text-end">{row.teamCount}</Td>
                      <Td className="tabular text-end">{formatUsdt(row.commission)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </CardBody>
      </Card>

      <FilterTabs
        basePath="/admin/referrals"
        params={params}
        paramName="level"
        options={LEVEL_OPTIONS}
        current={level}
      />

      {result.rows.length === 0 ? (
        <EmptyState title="No referral records" description="Nothing matches this filter." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Relationships</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Created</Th>
                    <Th>Upline</Th>
                    <Th>Level</Th>
                    <Th>Member</Th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.id}>
                      <Td className="whitespace-nowrap text-xs text-ink-muted">{formatDateTime(r.created_at)}</Td>
                      <Td>
                        {r.referrer ? (
                          <Link href={`/admin/users/${r.referrer.id}`} className="text-sm hover:text-brand">
                            {r.referrer.username ?? r.referrer.email}
                          </Link>
                        ) : (
                          <span className="text-sm text-ink-subtle">Unknown</span>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={r.level === 1 ? 'brand' : 'neutral'}>L{r.level}</Badge>
                      </Td>
                      <Td>
                        {r.referred ? (
                          <Link href={`/admin/users/${r.referred.id}`} className="text-sm hover:text-brand">
                            {r.referred.username ?? r.referred.email}
                          </Link>
                        ) : (
                          <span className="text-sm text-ink-subtle">Unknown</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </CardBody>
        </Card>
      )}

      <Pagination basePath="/admin/referrals" params={params} page={result} />
    </div>
  )
}
