import type { Metadata } from 'next'
import Link from 'next/link'
import { requireSession } from '@/lib/auth/session'
import { loadLedgerPage } from '@/lib/ledger/queries'
import { loadDashboard } from '@/lib/dashboard/queries'
import { Alert, ButtonLink, Card, CardBody, CardHeader, CardTitle, PageHeader, Stat } from '@/components/ui'
import { LedgerTable } from '@/components/ledger-table'
import { formatUsdt } from '@/lib/format'

export const metadata: Metadata = { title: 'Wallet' }
export const dynamic = 'force-dynamic'

export default async function WalletPage() {
  const session = await requireSession('/wallet')
  const [ledger, dashboard] = await Promise.all([
    loadLedgerPage(session.userId, { pageSize: 15 }),
    loadDashboard(session.userId),
  ])

  const { profile } = session

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wallet"
        description="Your internal platform ledger. Every movement below is an immutable accounting entry."
        actions={
          <>
            <ButtonLink href="/deposit" size="sm">
              Deposit
            </ButtonLink>
            <ButtonLink href="/withdraw" size="sm" variant="secondary">
              Withdraw
            </ButtonLink>
          </>
        }
      />

      <Card>
        <CardBody className="bg-brand-soft">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Internal Platform Balance</p>
          <p className="tabular mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            {formatUsdt(profile.balance_available)}
          </p>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-muted">
            Held in the platform&apos;s internal ledger, not in a blockchain wallet you control. Deposits are credited
            only after the transaction has been verified on chain; withdrawals are executed manually by the operations
            team from an external wallet.
          </p>
        </CardBody>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Today's rewards" value={formatUsdt(dashboard.todaysRewards)} tone="positive" />
        <Stat label="Total rewards" value={formatUsdt(profile.total_rewards)} />
        <Stat label="Total deposited" value={formatUsdt(profile.total_deposited)} sub="Chain verified" />
        <Stat label="Total withdrawn" value={formatUsdt(profile.total_withdrawn)} />
        <Stat
          label="Pending withdrawal"
          value={formatUsdt(profile.balance_pending_withdrawal)}
          sub={Number(profile.balance_pending_withdrawal) > 0 ? 'Locked until settled' : 'Nothing locked'}
          tone={Number(profile.balance_pending_withdrawal) > 0 ? 'negative' : undefined}
        />
        <Stat
          label="Total balance"
          value={formatUsdt(Number(profile.balance_available) + Number(profile.balance_pending_withdrawal))}
          sub="Available plus locked"
        />
      </div>

      {Number(profile.balance_pending_withdrawal) > 0 ? (
        <Alert tone="warning" title="Funds are locked for a withdrawal request">
          {formatUsdt(profile.balance_pending_withdrawal)} is held aside for a withdrawal that has not been settled yet.
          It is removed from your available balance so it cannot be spent twice.
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent movements</CardTitle>
          <Link href="/history" className="text-sm text-brand hover:underline">
            Full history
          </Link>
        </CardHeader>
        <CardBody className="pt-0">
          <LedgerTable entries={ledger.entries} sources={ledger.sources} />
        </CardBody>
      </Card>
    </div>
  )
}
