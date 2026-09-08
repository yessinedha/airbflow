import 'server-only'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getProviderForChain } from '@/lib/blockchain/networks/registry'
import type { Deposit, DepositAddress, SupportedNetwork } from '@/types/database'

export type VerificationReport =
  | { outcome: 'CREDITED'; depositId: string; amount: number; alreadyCredited: boolean }
  | { outcome: 'PENDING'; depositId: string; confirmations: number; required: number }
  | { outcome: 'REJECTED'; depositId: string; reason: string }
  | { outcome: 'UNAVAILABLE'; depositId: string; reason: string }
  | { outcome: 'SKIPPED'; depositId: string; reason: string }

/**
 * The single path by which a deposit can ever be credited.
 *
 * The chain is the authority for the amount, destination, token and
 * confirmation count. The number the user typed on /deposit is treated as
 * a declaration of intent only and never becomes a balance.
 */
export async function verifyAndSettleDeposit(depositId: string): Promise<VerificationReport> {
  const supabase = createSupabaseAdminClient()

  const { data: deposit, error } = await supabase
    .from('deposits')
    .select('*')
    .eq('id', depositId)
    .maybeSingle<Deposit>()

  if (error || !deposit) {
    return { outcome: 'SKIPPED', depositId, reason: 'Deposit not found.' }
  }
  if (deposit.status !== 'PENDING') {
    return { outcome: 'SKIPPED', depositId, reason: `Deposit is already ${deposit.status}.` }
  }
  if (!deposit.tx_hash) {
    return { outcome: 'SKIPPED', depositId, reason: 'No transaction hash submitted yet.' }
  }

  const { data: network } = await supabase
    .from('supported_networks')
    .select('*')
    .eq('code', deposit.network_code)
    .maybeSingle<SupportedNetwork>()

  if (!network) {
    return { outcome: 'UNAVAILABLE', depositId, reason: 'Network configuration is missing.' }
  }

  const { data: addresses } = await supabase
    .from('deposit_addresses')
    .select('*')
    .eq('network_id', network.id)
    .eq('active', true)
    .returns<DepositAddress[]>()

  const destinations = (addresses ?? []).map((a) => a.address)
  if (destinations.length === 0) {
    return await recordCheck(depositId, deposit.confirmations, { error: 'no_deposit_address' }, null, {
      outcome: 'UNAVAILABLE',
      depositId,
      reason: 'No deposit address is configured for this network.',
    })
  }

  const provider = getProviderForChain(network.chain)
  if (!provider) {
    return await recordCheck(depositId, deposit.confirmations, { error: 'no_provider', chain: network.chain }, null, {
      outcome: 'UNAVAILABLE',
      depositId,
      reason: `No verification provider is implemented for chain "${network.chain}".`,
    })
  }
  if (!provider.isConfigured()) {
    return await recordCheck(depositId, deposit.confirmations, { error: 'provider_unconfigured' }, null, {
      outcome: 'UNAVAILABLE',
      depositId,
      reason: `Verification for "${network.chain}" is not configured on this deployment.`,
    })
  }

  const result = await provider.getTokenTransfer(deposit.tx_hash, destinations, {
    tokenContract: network.token_contract,
    tokenDecimals: network.token_decimals,
    requiredConfirmations: network.required_confirmations,
  })

  if (result.status === 'UNAVAILABLE') {
    return await recordCheck(depositId, deposit.confirmations, { error: result.reason }, null, {
      outcome: 'UNAVAILABLE',
      depositId,
      reason: result.reason,
    })
  }

  if (result.status === 'REJECTED') {
    return await recordCheck(depositId, deposit.confirmations, result.raw, result.reason, {
      outcome: 'REJECTED',
      depositId,
      reason: result.reason,
    })
  }

  if (result.status === 'PENDING') {
    return await recordCheck(depositId, result.confirmations, result.raw, null, {
      outcome: 'PENDING',
      depositId,
      confirmations: result.confirmations,
      required: result.required,
    })
  }

  // CONFIRMED. Credit exactly what the chain says was received.
  const { transfer } = result
  const { data: credited, error: creditError } = await supabase.rpc('credit_verified_deposit', {
    p_deposit_id: depositId,
    p_verified_amount: transfer.amount,
    p_from_address: transfer.from,
    p_to_address: transfer.to,
    p_token_contract: transfer.tokenContract,
    p_confirmations: transfer.confirmations,
    p_payload: {
      ...result.raw,
      verified_at: new Date().toISOString(),
      raw_amount: transfer.rawAmount,
      declared_amount: deposit.amount,
      block_number: transfer.blockNumber,
      chain: network.chain,
    },
  })

  if (creditError) {
    console.error('[deposit-verification] credit failed', depositId, creditError.message)
    return { outcome: 'UNAVAILABLE', depositId, reason: 'Crediting failed; the deposit stays pending for retry.' }
  }

  const payload = credited as { credited_amount?: number; already_credited?: boolean } | null
  return {
    outcome: 'CREDITED',
    depositId,
    amount: Number(payload?.credited_amount ?? transfer.amount),
    alreadyCredited: Boolean(payload?.already_credited),
  }
}

async function recordCheck(
  depositId: string,
  confirmations: number,
  payload: Record<string, unknown>,
  rejectReason: string | null,
  report: VerificationReport,
): Promise<VerificationReport> {
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.rpc('record_deposit_check', {
    p_deposit_id: depositId,
    p_confirmations: confirmations,
    p_payload: payload,
    p_reject_reason: rejectReason,
  })
  if (error) console.error('[deposit-verification] record_deposit_check failed', depositId, error.message)
  return report
}

/**
 * Re-checks every pending deposit that has a transaction hash. Called by
 * the scheduled job so deposits that are merely waiting for confirmations
 * settle on their own.
 */
export async function verifyPendingDeposits(limit = 50): Promise<VerificationReport[]> {
  const supabase = createSupabaseAdminClient()

  const { data: pending } = await supabase
    .from('deposits')
    .select('id')
    .eq('status', 'PENDING')
    .not('tx_hash', 'is', null)
    .order('created_at', { ascending: true })
    .limit(limit)
    .returns<{ id: string }[]>()

  const reports: VerificationReport[] = []
  for (const row of pending ?? []) {
    try {
      reports.push(await verifyAndSettleDeposit(row.id))
    } catch (err) {
      console.error('[deposit-verification] unexpected failure', row.id, err)
      reports.push({
        outcome: 'UNAVAILABLE',
        depositId: row.id,
        reason: err instanceof Error ? err.message : 'unknown error',
      })
    }
  }
  return reports
}
