import type { Metadata } from 'next'
import { requireSession } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { markAllNotificationsReadAction, markNotificationReadAction } from '@/lib/notifications/actions'
import { Badge, Button, Card, CardBody, EmptyState, PageHeader } from '@/components/ui'
import { formatDateTime, formatRelative } from '@/lib/format'
import type { Notification, NotificationType } from '@/types/database'

export const metadata: Metadata = { title: 'Notifications' }
export const dynamic = 'force-dynamic'

const TONES: Record<NotificationType, 'neutral' | 'positive' | 'warning' | 'negative' | 'info'> = {
  INFO: 'info',
  SUCCESS: 'positive',
  WARNING: 'warning',
  ERROR: 'negative',
}

export default async function NotificationsPage() {
  const session = await requireSession('/notifications')
  const supabase = await createSupabaseServerClient()

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(100)
    .returns<Notification[]>()

  const rows = notifications ?? []
  const unread = rows.filter((n) => !n.read).length

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : 'You are all caught up.'}
        actions={
          unread > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <Button type="submit" variant="secondary" size="sm">
                Mark all as read
              </Button>
            </form>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="Nothing here yet"
              description="Deposits, task rewards, referral activity and withdrawal updates all show up on this page."
            />
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-2">
          {rows.map((n) => (
            <li key={n.id}>
              <Card className={n.read ? undefined : 'border-brand/40'}>
                <CardBody className="flex flex-wrap items-start justify-between gap-3 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={TONES[n.type]}>{n.type}</Badge>
                      <p className="font-medium">{n.title}</p>
                      {!n.read ? <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-label="Unread" /> : null}
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">{n.message}</p>
                    <p className="mt-1 text-xs text-ink-subtle" title={formatDateTime(n.created_at)}>
                      {formatRelative(n.created_at)}
                    </p>
                  </div>

                  {!n.read ? (
                    <form action={markNotificationReadAction}>
                      <input type="hidden" name="notificationId" value={n.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Mark read
                      </Button>
                    </form>
                  ) : null}
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
