import Link from 'next/link'
import { Table, TableWrap, Td, Th } from '@/components/ui'
import { LedgerTypeBadge } from '@/components/status'
import { formatDateTime, formatSignedUsdt, formatUsdt, shortHash } from '@/lib/format'
import { IconExternal } from '@/components/icons'
import type { LedgerEntry } from '@/types/database'

export interface LedgerSourceLink {
  href: string
  label: string
  txHash?: string | null
  explorerUrl?: string | null
}

/**
 * Renders ledger movements with a link back to whatever produced them, so
 * every number on the wallet page can be traced to its source record and,
 * where one exists, to the on-chain transaction.
 */
export function LedgerTable({
  entries,
  sources,
  showBalance = true,
}: {
  entries: LedgerEntry[]
  sources?: Record<string, LedgerSourceLink>
  showBalance?: boolean
}) {
  if (entries.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-muted">No ledger entries yet.</p>
  }

  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>Date</Th>
            <Th>Type</Th>
            <Th>Details</Th>
            <Th className="text-right">Amount</Th>
            {showBalance ? <Th className="text-right">Balance after</Th> : null}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const source = entry.reference_id ? sources?.[entry.reference_id] : undefined
            const positive = Number(entry.amount) >= 0

            return (
              <tr key={entry.id}>
                <Td className="whitespace-nowrap text-ink-muted">{formatDateTime(entry.created_at)}</Td>
                <Td>
                  <LedgerTypeBadge type={entry.type} />
                </Td>
                <Td className="max-w-xs">
                  <p className="truncate text-ink-muted">{entry.description ?? '—'}</p>
                  {source ? (
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                      <Link href={source.href} className="text-brand hover:underline">
                        {source.label}
                      </Link>
                      {source.txHash ? (
                        source.explorerUrl ? (
                          <a
                            href={source.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-ink-subtle hover:text-brand"
                          >
                            {shortHash(source.txHash)}
                            <IconExternal />
                          </a>
                        ) : (
                          <span className="font-mono text-ink-subtle">{shortHash(source.txHash)}</span>
                        )
                      ) : null}
                    </div>
                  ) : null}
                </Td>
                <Td className={`tabular text-right font-semibold ${positive ? 'text-positive' : 'text-negative'}`}>
                  {formatSignedUsdt(entry.amount)}
                </Td>
                {showBalance ? <Td className="tabular text-right text-ink-muted">{formatUsdt(entry.balance_after)}</Td> : null}
              </tr>
            )
          })}
        </tbody>
      </Table>
    </TableWrap>
  )
}
