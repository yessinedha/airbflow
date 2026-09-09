import type { Metadata } from 'next'
import { requireSession } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { siteUrl } from '@/lib/env'
import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Stat,
  Table,
  TableWrap,
  Td,
  Th,
} from '@/components/ui'
import { CopyButton } from '@/components/deposit-forms'
import { formatDate, formatUsdt } from '@/lib/format'
import type { PlatformSetting, TeamMember, TeamSummary } from '@/types/database'
import { getT } from '@/lib/i18n/server'

export const metadata: Metadata = { title: 'Team' }
export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const session = await requireSession('/team')
  const supabase = await createSupabaseServerClient()

  const [{ data: summaryRaw }, { data: membersRaw }, { data: settings }] = await Promise.all([
    supabase.rpc('get_team_summary', { p_user_id: session.userId }),
    supabase.rpc('get_team_members', { p_user_id: session.userId, p_level: null }),
    supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', [
        'referral_level1_percent',
        'referral_level2_percent',
        'referral_level3_percent',
        'referral_rewards_enabled',
      ])
      .returns<PlatformSetting[]>(),
  ])

  const summary = (summaryRaw as TeamSummary) ?? null
  const members = (membersRaw as TeamMember[]) ?? []
  const settingMap = new Map((settings ?? []).map((s) => [s.key, s.value]))

  const percent = (level: number) => {
    const raw = settingMap.get(`referral_level${level}_percent`)
    const n = Number(raw ?? 0)
    return Number.isFinite(n) ? n * 100 : 0
  }
  const rewardsEnabled = String(settingMap.get('referral_rewards_enabled') ?? 'true') === 'true'

  const t = await getT()
  const inviteLink = `${siteUrl()}/register?ref=${session.profile.referral_code}`
  const byLevel = (level: number) => members.filter((m) => m.level === level)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.team.title}
        description={t.team.description}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t.team.yourInvitation}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4 pt-0">
          <div>
            <p className="label-mono text-ink-subtle">{t.team.invitationCode}</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="rounded-lg bg-surface-2 px-3 py-2 font-mono text-lg font-semibold tracking-widest">
                {session.profile.referral_code}
              </code>
              <CopyButton value={session.profile.referral_code} label={t.team.copyCode} />
            </div>
          </div>

          <div>
            <p className="label-mono text-ink-subtle">{t.team.invitationLink}</p>
            <div className="mt-1 flex items-start gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-surface-2 px-2.5 py-2 font-mono text-xs">
                {inviteLink}
              </code>
              <CopyButton value={inviteLink} label={t.team.copyLink} />
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t.team.totalTeam} value={summary?.total ?? 0} sub={t.team.acrossLevels} />
        <Stat
          label={t.team.levelDirect}
          value={summary?.level1 ?? 0}
          sub={t.team.commissionPercent(percent(1).toFixed(1))}
        />
        <Stat label={t.team.level2} value={summary?.level2 ?? 0} sub={t.team.commissionPercent(percent(2).toFixed(1))} />
        <Stat label={t.team.level3} value={summary?.level3 ?? 0} sub={t.team.commissionPercent(percent(3).toFixed(1))} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Stat
          label={t.team.commissionEarned}
          value={formatUsdt(summary?.total_commission ?? 0)}
          tone="positive"
          sub={t.team.commissionEarnedSub}
        />
        <Stat
          label={t.team.activeMembers}
          value={summary?.active_members ?? 0}
          sub={t.team.ofTotal(summary?.total ?? 0)}
        />
      </div>

      <Alert tone="info" title={t.team.fundingTitle}>
        {t.team.fundingBody}
        {!rewardsEnabled ? t.team.disabledNote : ''}
      </Alert>

      {members.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title={t.team.emptyTitle}
              description={t.team.emptyBody}
            />
          </CardBody>
        </Card>
      ) : (
        [1, 2, 3].map((level) => {
          const rows = byLevel(level)
          if (rows.length === 0) return null

          return (
            <Card key={level}>
              <CardHeader>
                <CardTitle>{t.team.levelHeading(level)}</CardTitle>
                <Badge tone="brand">{t.team.memberCount(rows.length, percent(level).toFixed(1))}</Badge>
              </CardHeader>
              <CardBody className="pt-0">
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th>{t.common.member}</Th>
                        <Th>{t.team.joined}</Th>
                        <Th>{t.team.plan}</Th>
                        <Th>{t.common.status}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((m) => (
                        <tr key={m.user_id}>
                          <Td>
                            <p className="font-medium">{m.username ?? t.team.memberFallback}</p>
                            <p className="text-xs text-ink-subtle">{m.masked_email}</p>
                          </Td>
                          <Td className="whitespace-nowrap text-ink-muted">{formatDate(m.joined_at)}</Td>
                          <Td>
                            {m.vip_plan ? (
                              <Badge tone="brand">{m.vip_plan}</Badge>
                            ) : (
                              <span className="text-ink-subtle">{t.common.dash}</span>
                            )}
                          </Td>
                          <Td>
                            <Badge tone={m.is_active ? 'positive' : 'neutral'}>
                              {m.is_active ? t.common.active : t.common.inactive}
                            </Badge>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              </CardBody>
            </Card>
          )
        })
      )}
    </div>
  )
}
