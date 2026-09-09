import type { Metadata } from 'next'
import Link from 'next/link'
import { requireSession } from '@/lib/auth/session'
import { loadLedgerPage } from '@/lib/ledger/queries'
import { Card, CardBody, PageHeader } from '@/components/ui'
import { LedgerTable } from '@/components/ledger-table'
import { LEDGER_LABELS } from '@/components/status'
import { cn } from '@/utils/cn'
import type { LedgerType } from '@/types/database'
import { getT } from '@/lib/i18n/server'

export const metadata: Metadata = { title: 'History' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25
const TYPES = Object.keys(LEDGER_LABELS) as LedgerType[]

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string }>
}) {
  const session = await requireSession('/history')
  const params = await searchParams

  const page = Math.max(1, Number(params.page ?? '1') || 1)
  const type = TYPES.includes(params.type as LedgerType) ? params.type : undefined

  const { entries, sources, total } = await loadLedgerPage(session.userId, { page, pageSize: PAGE_SIZE, type })
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const t = await getT()

  const buildHref = (nextPage: number, nextType?: string) => {
    const search = new URLSearchParams()
    if (nextPage > 1) search.set('page', String(nextPage))
    if (nextType) search.set('type', nextType)
    const qs = search.toString()
    return qs ? `/history?${qs}` : '/history'
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.history.title}
        description={t.history.description(total)}
      />

      <div className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <FilterChip href={buildHref(1)} active={!type}>
          {t.common.all}
        </FilterChip>
        {TYPES.map((entryType) => (
          <FilterChip key={entryType} href={buildHref(1, entryType)} active={type === entryType}>
            {t.ledgerTypes[entryType]}
          </FilterChip>
        ))}
      </div>

      <Card>
        <CardBody>
          <LedgerTable
            entries={entries}
            sources={sources}
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

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label={t.history.pagination}>
          <PageLink href={buildHref(page - 1, type)} disabled={page <= 1}>
            {t.common.previous}
          </PageLink>
          <span className="text-sm text-ink-muted">{t.common.pageOf(page, totalPages)}</span>
          <PageLink href={buildHref(page + 1, type)} disabled={page >= totalPages}>
            {t.common.next}
          </PageLink>
        </nav>
      ) : null}
    </div>
  )
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active ? 'border-brand bg-brand-soft text-brand' : 'border-border text-ink-muted hover:bg-surface-2',
      )}
    >
      {children}
    </Link>
  )
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) {
    return <span className="cursor-not-allowed rounded-lg border border-border px-3 py-2 text-sm opacity-40">{children}</span>
  }
  return (
    <Link href={href} className="rounded-lg border border-border-strong px-3 py-2 text-sm hover:bg-surface-2">
      {children}
    </Link>
  )
}
