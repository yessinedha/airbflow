import type { Metadata } from 'next'
import Link from 'next/link'
import { loadRecentNotifications, pageParam } from '@/lib/admin/queries'
import { Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader } from '@/components/ui'
import { BroadcastForm } from '@/components/admin/config-forms'
import { Pagination } from '@/components/admin/controls'
import { formatDateTime } from '@/lib/format'

export const metadata: Metadata = { title: 'Notifications' }
export const dynamic = 'force-dynamic'

const TONE = {
  INFO: 'info',
  SUCCESS: 'positive',
  WARNING: 'warning',
  ERROR: 'negative',
} as const

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const page = pageParam(sp.page)
  const result = await loadRecentNotifications({ page })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="Deposits, task rewards, withdrawals and team joins already notify users automatically. Use the broadcast below only for announcements."
      />

      <Card>
        <CardHeader>
          <CardTitle>Send an announcement</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          <BroadcastForm />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recently delivered</CardTitle>
        </CardHeader>
        <CardBody className="pt-0">
          {result.rows.length === 0 ? (
            <EmptyState title="Nothing sent yet" description="Notifications appear here as the platform generates them." />
          ) : (
            <ul className="divide-y divide-border">
              {result.rows.map((n) => (
                <li key={n.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{n.title}</p>
                        <Badge tone={TONE[n.type]}>{n.type}</Badge>
                        {n.read ? null : <Badge tone="brand">Unread</Badge>}
                      </div>
                      <p className="mt-0.5 text-sm text-ink-muted">{n.message}</p>
                    </div>
                    <div className="text-right text-xs text-ink-subtle">
                      {n.user ? (
                        <Link href={`/admin/users/${n.user.id}`} className="hover:text-brand">
                          {n.user.email}
                        </Link>
                      ) : (
                        'Unknown user'
                      )}
                      <p>{formatDateTime(n.created_at)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Pagination basePath="/admin/notifications" params={{ page: String(page) }} page={result} />
    </div>
  )
}
