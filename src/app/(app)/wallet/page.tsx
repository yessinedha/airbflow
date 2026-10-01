import type { Metadata } from 'next'
import Link from 'next/link'
import { requireSession } from '@/lib/auth/session'
import { loadLedgerPage } from '@/lib/ledger/queries'
import { loadDashboard } from '@/lib/dashboard/queries'
import { Alert, ButtonLink, Card, CardBody, CardHeader, CardTitle, PageHeader, Stat } from '@/components/ui'
import { LedgerTable } from '@/components/ledger-table'
import { formatUsdt } from '@/lib/format'
import { getT } from '@/lib/i18n/server'

export const metadata: Metadata = { title: 'Wallet' }
export const dynamic = 'force-dynamic'

export default async function WalletPage() {
  const session = await requireSession('/wallet')
  const [ledger, dashboard] = await Promise.all([
    loadLedgerPage(session.userId, { pageSize: 15 }),
    loadDashboard(session.userId),
  ])

  const { profile } = session
  const t = await getT()

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.wallet.title}
        description={t.wallet.description}
        actions={
          <>
            <ButtonLink href="/deposit" size="sm">
              {t.nav.deposit}
            </ButtonLink>
            <ButtonLink href="/withdraw" size="sm" variant="secondary">
              {t.nav.withdraw}
            </ButtonLink>
          </>
        }
      />

      <Card>
        <CardBody className="bg-brand-soft">
          <p className="label-mono text-ink-muted">{t.wallet.balanceLabel}</p>
          <p className="tabular mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            {formatUsdt(profile.balance_available)}
          </p>
          {t.wallet.balanceNote ? (
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-muted">{t.wallet.balanceNote}</p>
          ) : null}
        </CardBody>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label={t.wallet.todaysRewards} value={formatUsdt(dashboard.todaysRewards)} tone="positive" />
        <Stat label={t.wallet.totalRewards} value={formatUsdt(profile.total_rewards)} />
        <Stat label={t.wallet.totalDeposited} value={formatUsdt(profile.total_deposited)} sub={t.wallet.chainVerified} />
        <Stat label={t.wallet.totalWithdrawn} value={formatUsdt(profile.total_withdrawn)} />
        <Stat
          label={t.wallet.pendingWithdrawal}
          value={formatUsdt(profile.balance_pending_withdrawal)}
          sub={Number(profile.balance_pending_withdrawal) > 0 ? t.wallet.lockedUntilSettled : t.wallet.nothingLocked}
          tone={Number(profile.balance_pending_withdrawal) > 0 ? 'negative' : undefined}
        />
        <Stat
          label={t.wallet.totalBalance}
          value={formatUsdt(Number(profile.balance_available) + Number(profile.balance_pending_withdrawal))}
          sub={t.wallet.availablePlusLocked}
        />
      </div>

      {Number(profile.balance_pending_withdrawal) > 0 ? (
        <Alert tone="warning" title={t.wallet.lockedTitle}>
          {t.wallet.lockedBody(formatUsdt(profile.balance_pending_withdrawal))}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t.wallet.recentMovements}</CardTitle>
          <Link href="/history" className="text-sm text-brand hover:underline">
            {t.dashboard.fullHistory}
          </Link>
        </CardHeader>
        <CardBody className="pt-0">
          <LedgerTable
            entries={ledger.entries}
            sources={ledger.sources}
            labels={{
              date: t.common.date,
              type: t.common.type,
              details: t.common.details,
              amount: t.common.amount,
              balanceAfter: t.ledgerTable.balanceAfter,
              empty: t.ledgerTable.empty,
              types: t.ledgerTypes,
            }}
          />
        </CardBody>
      </Card>
    </div>
  )
}
