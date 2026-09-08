import 'server-only'

import { formatUnits, type ChainProvider, type ProviderContext, type VerificationOutcome } from '@/lib/blockchain/types'

/** keccak256("Transfer(address,address,uint256)") */
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

interface RpcLog {
  address: string
  topics: string[]
  data: string
}

interface RpcReceipt {
  status?: string
  blockNumber?: string
  from?: string
  logs?: RpcLog[]
}

const TIMEOUT_MS = 12_000

function topicToAddress(topic: string): string {
  return `0x${topic.replace(/^0x/, '').slice(-40)}`.toLowerCase()
}

/**
 * Verifies ERC20-style transfers on any EVM chain through a plain JSON-RPC
 * endpoint. Only `eth_getTransactionReceipt` and `eth_blockNumber` are used,
 * so any public or private RPC provider works without an SDK.
 */
export class EvmProvider implements ChainProvider {
  readonly chain: string
  private readonly rpcUrl: string | undefined

  constructor(chain: string, rpcUrl?: string) {
    this.chain = chain
    this.rpcUrl = rpcUrl ?? resolveRpcUrl(chain)
  }

  isConfigured(): boolean {
    return Boolean(this.rpcUrl)
  }

  async getTokenTransfer(
    txHash: string,
    destinationAddresses: string[],
    context: ProviderContext,
  ): Promise<VerificationOutcome> {
    if (!this.rpcUrl) {
      return {
        status: 'UNAVAILABLE',
        reason: `No RPC endpoint configured for chain "${this.chain}".`,
      }
    }

    const hash = txHash.trim().toLowerCase()
    if (!/^0x[0-9a-f]{64}$/.test(hash)) {
      return { status: 'REJECTED', reason: 'Malformed EVM transaction hash.', raw: { txHash } }
    }

    let receipt: RpcReceipt | null
    let head: number
    try {
      ;[receipt, head] = await Promise.all([
        this.rpc<RpcReceipt | null>('eth_getTransactionReceipt', [hash]),
        this.rpc<string>('eth_blockNumber', []).then((v) => parseInt(v, 16)),
      ])
    } catch (err) {
      return {
        status: 'UNAVAILABLE',
        reason: `RPC endpoint unreachable: ${err instanceof Error ? err.message : 'unknown error'}`,
      }
    }

    if (!receipt) {
      // Broadcast but not mined yet, or unknown to this node.
      return { status: 'PENDING', confirmations: 0, required: context.requiredConfirmations, raw: { txHash: hash } }
    }

    if (receipt.status !== undefined && receipt.status !== '0x1') {
      return {
        status: 'REJECTED',
        reason: 'Transaction reverted on chain.',
        raw: receipt as unknown as Record<string, unknown>,
      }
    }

    const expectedContract = context.tokenContract.trim().toLowerCase()
    const destinations = new Set(destinationAddresses.map((a) => a.trim().toLowerCase()))
    if (destinations.size === 0) {
      return { status: 'UNAVAILABLE', reason: 'No deposit address is configured for this network.' }
    }

    const blockNumber = receipt.blockNumber ? parseInt(receipt.blockNumber, 16) : null
    const confirmations = blockNumber && head ? Math.max(head - blockNumber + 1, 0) : 0

    let sawWrongToken = false
    let sawTransferToOther = false

    for (const log of receipt.logs ?? []) {
      if ((log.topics?.[0] ?? '').toLowerCase() !== TRANSFER_TOPIC) continue
      if (log.topics.length < 3) continue

      if (log.address.toLowerCase() !== expectedContract) {
        sawWrongToken = true
        continue
      }

      const to = topicToAddress(log.topics[2]!)
      const from = topicToAddress(log.topics[1]!)

      if (!destinations.has(to)) {
        sawTransferToOther = true
        continue
      }

      const rawAmount = BigInt(log.data === '0x' || !log.data ? '0x0' : log.data)
      if (rawAmount <= 0n) continue

      const transfer = {
        txHash: hash,
        from,
        to,
        tokenContract: log.address.toLowerCase(),
        rawAmount: rawAmount.toString(),
        amount: formatUnits(rawAmount, context.tokenDecimals),
        confirmations,
        blockNumber,
        success: true,
      }

      if (confirmations < context.requiredConfirmations) {
        return {
          status: 'PENDING',
          confirmations,
          required: context.requiredConfirmations,
          raw: { transfer, blockNumber, head },
        }
      }

      return { status: 'CONFIRMED', transfer, raw: { blockNumber, head } }
    }

    if (sawWrongToken) {
      return {
        status: 'REJECTED',
        reason: 'The transaction transfers a different token than the one configured for this network.',
        raw: receipt as unknown as Record<string, unknown>,
      }
    }
    if (sawTransferToOther) {
      return {
        status: 'REJECTED',
        reason: 'The transaction was not sent to a platform deposit address.',
        raw: receipt as unknown as Record<string, unknown>,
      }
    }

    return {
      status: 'REJECTED',
      reason: 'No matching token transfer was found in this transaction.',
      raw: receipt as unknown as Record<string, unknown>,
    }
  }

  private async rpc<T>(method: string, params: unknown[]): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(this.rpcUrl!, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`RPC returned ${res.status}`)
      const json = (await res.json()) as { result?: T; error?: { message?: string } }
      if (json.error) throw new Error(json.error.message ?? 'RPC error')
      return json.result as T
    } finally {
      clearTimeout(timer)
    }
  }
}

/**
 * Resolves the RPC endpoint for a chain.
 *
 * `EVM_RPC_URLS` allows any number of extra chains without a code change,
 * e.g. `EVM_RPC_URLS=polygon=https://...,arbitrum=https://...`
 */
function resolveRpcUrl(chain: string): string | undefined {
  const key = chain.trim().toLowerCase()

  const multi = process.env.EVM_RPC_URLS
  if (multi) {
    for (const pair of multi.split(',')) {
      const [name, ...rest] = pair.split('=')
      if (name?.trim().toLowerCase() === key && rest.length) return rest.join('=').trim()
    }
  }

  if (key === 'bsc' || key === 'bnb' || key === 'binance') return process.env.BSC_RPC_URL
  if (key === 'ethereum' || key === 'eth' || key === 'mainnet') return process.env.ETH_RPC_URL
  return undefined
}
