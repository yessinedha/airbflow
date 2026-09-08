/**
 * Provider-agnostic view of a token transfer.
 *
 * Every field here is read from the chain. Nothing in this module ever
 * accepts a value supplied by a user, and no module in `blockchain/` holds,
 * derives or transmits a private key.
 */
export interface OnChainTransfer {
  /** Canonical transaction hash as reported by the chain. */
  txHash: string
  /** Sender, in the chain's usual display encoding. */
  from: string
  /** Recipient, in the chain's usual display encoding. */
  to: string
  /** Token contract the transfer belongs to, display encoding. */
  tokenContract: string
  /** Raw on-chain integer amount, before decimal scaling. */
  rawAmount: string
  /** Human amount, scaled by the token's decimals. */
  amount: number
  /** Confirmations at the moment of the lookup. */
  confirmations: number
  /** Block the transaction was included in, when known. */
  blockNumber: number | null
  /** Whether the transaction itself executed successfully. */
  success: boolean
}

export type VerificationOutcome =
  /** Chain data matched every rule; safe to credit `transfer.amount`. */
  | { status: 'CONFIRMED'; transfer: OnChainTransfer; raw: Record<string, unknown> }
  /** Found on chain but not yet deep enough, or not yet mined. */
  | { status: 'PENDING'; confirmations: number; required: number; raw: Record<string, unknown> }
  /** Definitively wrong: wrong token, wrong destination, failed tx. */
  | { status: 'REJECTED'; reason: string; raw: Record<string, unknown> }
  /** Could not be determined right now (provider missing or unreachable). */
  | { status: 'UNAVAILABLE'; reason: string }

export interface ProviderContext {
  /** Public token contract expected for this network. */
  tokenContract: string
  tokenDecimals: number
  requiredConfirmations: number
}

export interface ChainProvider {
  readonly chain: string
  /** False when the necessary RPC/API configuration is absent. */
  isConfigured(): boolean
  /**
   * Looks a transaction up and extracts the token transfer that is
   * addressed to one of `destinationAddresses`.
   */
  getTokenTransfer(
    txHash: string,
    destinationAddresses: string[],
    context: ProviderContext,
  ): Promise<VerificationOutcome>
}

/** Scales a raw integer string by `decimals` without floating point drift. */
export function formatUnits(raw: string | bigint, decimals: number): number {
  const value = typeof raw === 'bigint' ? raw : BigInt(raw)
  if (decimals === 0) return Number(value)

  const base = BigInt(10) ** BigInt(decimals)
  const whole = value / base
  const fraction = value % base
  const fractionStr = fraction.toString().padStart(decimals, '0')
  return Number(`${whole}.${fractionStr}`)
}
