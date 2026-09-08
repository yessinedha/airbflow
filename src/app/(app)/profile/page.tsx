import type { Metadata } from 'next'
import { requireSession } from '@/lib/auth/session'
import { Badge, Card, CardBody, CardHeader, CardTitle, PageHeader } from '@/components/ui'
import { UserStatusBadge } from '@/components/status'
import { ChangePasswordForm, UsernameForm } from '@/components/profile-forms'
import { formatDateTime } from '@/lib/format'

export const metadata: Metadata = { title: 'Profile' }
export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const session = await requireSession('/profile')
  const { profile, vipPlan } = session

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your account details and security settings." />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <UserStatusBadge status={profile.status} />
          </CardHeader>
          <CardBody className="space-y-3 pt-0 text-sm">
            <Row label="Email" value={profile.email} />
            <Row label="Username" value={profile.username ?? '—'} />
            <Row
              label="Role"
              value={
                profile.role === 'USER' ? (
                  'Member'
                ) : (
                  <Badge tone="brand">{profile.role.replace('_', ' ')}</Badge>
                )
              }
            />
            <Row label="Invitation code" value={<code className="font-mono">{profile.referral_code}</code>} />
            <Row label="Current plan" value={vipPlan?.name ?? 'None'} />
            <Row label="Member since" value={formatDateTime(profile.created_at)} />
            <Row
              label="First activation"
              value={profile.first_activation_at ? formatDateTime(profile.first_activation_at) : 'Not activated yet'}
            />
            <Row
              label="Two-factor authentication"
              value={
                profile.two_factor_enabled ? (
                  <Badge tone="positive">Enabled</Badge>
                ) : (
                  <Badge tone="neutral">Not enabled</Badge>
                )
              }
            />
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Change username</CardTitle>
            </CardHeader>
            <CardBody className="pt-0">
              <UsernameForm current={profile.username ?? ''} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
            </CardHeader>
            <CardBody className="pt-0">
              <ChangePasswordForm />
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Things that cannot be changed</CardTitle>
        </CardHeader>
        <CardBody className="pt-0 text-sm text-ink-muted">
          <ul className="list-disc space-y-1 pl-5">
            <li>Your invitation code, so existing invitation links keep working.</li>
            <li>Who invited you. The referral relationship is fixed at registration and enforced by the database.</li>
            <li>Your ledger entries. Every balance change is permanent; corrections are added as new entries.</li>
          </ul>
        </CardBody>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2.5 last:border-0 last:pb-0">
      <span className="text-ink-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
