import type { Metadata } from 'next'
import { requireSession } from '@/lib/auth/session'
import { Badge, Card, CardBody, CardHeader, CardTitle, PageHeader } from '@/components/ui'
import { UserStatusBadge } from '@/components/status'
import { ChangePasswordForm, UsernameForm } from '@/components/profile-forms'
import { formatDateTime } from '@/lib/format'
import { getT } from '@/lib/i18n/server'

export const metadata: Metadata = { title: 'Profile' }
export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const session = await requireSession('/profile')
  const { profile, vipPlan } = session
  const t = await getT()

  return (
    <div className="space-y-6">
      <PageHeader title={t.profile.title} description={t.profile.description} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.profile.account}</CardTitle>
            <UserStatusBadge status={profile.status} />
          </CardHeader>
          <CardBody className="space-y-3 pt-0 text-sm">
            <Row label={t.profile.email} value={profile.email} />
            <Row label={t.profile.username} value={profile.username ?? t.common.dash} />
            <Row
              label={t.profile.role}
              value={
                profile.role === 'USER' ? (
                  t.profile.roleMember
                ) : (
                  <Badge tone="brand">{profile.role.replace('_', ' ')}</Badge>
                )
              }
            />
            <Row label={t.profile.invitationCode} value={<code className="font-mono">{profile.referral_code}</code>} />
            <Row label={t.profile.currentPlan} value={vipPlan?.name ?? t.common.none} />
            <Row label={t.profile.memberSince} value={formatDateTime(profile.created_at)} />
            <Row
              label={t.profile.firstActivation}
              value={
                profile.first_activation_at ? formatDateTime(profile.first_activation_at) : t.profile.notActivated
              }
            />
            <Row
              label={t.profile.twoFactor}
              value={
                profile.two_factor_enabled ? (
                  <Badge tone="positive">{t.profile.enabled}</Badge>
                ) : (
                  <Badge tone="neutral">{t.profile.notEnabled}</Badge>
                )
              }
            />
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>{t.profile.changeUsername}</CardTitle>
            </CardHeader>
            <CardBody className="pt-0">
              <UsernameForm current={profile.username ?? ''} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.profile.changePassword}</CardTitle>
            </CardHeader>
            <CardBody className="pt-0">
              <ChangePasswordForm />
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.profile.immutableTitle}</CardTitle>
        </CardHeader>
        <CardBody className="pt-0 text-sm text-ink-muted">
          <ul className="list-disc space-y-1 ps-5">
            {t.profile.immutableItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
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
