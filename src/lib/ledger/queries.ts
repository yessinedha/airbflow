import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { explorerUrl } from '@/lib/format'
import type { LedgerSourceLink } from '@/components/ledger-table'
import type { Deposit, LedgerEntry, SupportedNetwork, Withdrawal } from '@/types/database'

export interface LedgerPage {
  entries: LedgerEntry[]
  sources: Record<string, LedgerSourceLink>
  total: number
}

/**
 * Loads a page of ledger entries plus the deposit / withdrawal rows they
 * point at, so each row can be traced to its origin without an N+1 query.
 */
export async function loadLedgerPage(
  userId: string,
  { page = 1, pageSize = 25, type }: { page?: number; pageSize?: number; type?: string } = {},
): Promise<LedgerPage> {
  const supabase = await createSupabaseServerClient()
  const from = (page - 1) * pageSize

  let query = supabase
    .from('ledger_entries')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('seq', { ascending: false })
    .range(from, from + pageSize - 1)

  if (type) query = query.eq('type', type)

  const { data: entries, count } = await query.returns<LedgerEntry[]>()
  const rows = entries ?? []

  const depositIds = rows.filter((e) => e.reference_type === 'deposit' && e.reference_id).map((e) => e.reference_id!)
  const withdrawalIds = rows
    .filter((e) => e.reference_type === 'withdrawal' && e.reference_id)
    .map((e) => e.reference_id!)

  const [deposits, withdrawals, networks] = await Promise.all([
    depositIds.length
      ? supabase.from('deposits').select('id, tx_hash, network_code').in('id', depositIds).returns<Deposit[]>()
      : Promise.resolve({ data: [] as Deposit[] }),
    withdrawalIds.length
      ? supabase
          .from('withdrawals')
          .select('id, tx_hash, network_code')
          .in('id', withdrawalIds)
          .returns<Withdrawal[]>()
      : Promise.resolve({ data: [] as Withdrawal[] }),
    supabase.from('supported_networks').select('code, explorer_tx_url').returns<SupportedNetwork[]>(),
  ])

  const explorerByCode = new Map((networks.data ?? []).map((n) => [n.code, n.explorer_tx_url]))
  const sources: Record<string, LedgerSourceLink> = {}

  for (const d of deposits.data ?? []) {
    sources[d.id] = {
      href: '/deposit',
      label: 'Deposit',
      txHash: d.tx_hash,
      explorerUrl: explorerUrl(explorerByCode.get(d.network_code), d.tx_hash),
    }
  }

  for (const w of withdrawals.data ?? []) {
    sources[w.id] = {
      href: '/withdraw',
      label: 'Withdrawal',
      txHash: w.tx_hash,
      explorerUrl: explorerUrl(explorerByCode.get(w.network_code), w.tx_hash),
    }
  }

  return { entries: rows, sources, total: count ?? 0 }
}
