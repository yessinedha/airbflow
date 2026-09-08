import 'server-only'

import { formatUnits, type ChainProvider, type ProviderContext, type VerificationOutcome } from '@/lib/blockchain/types'
import { normaliseTronAddress, tronHexToBase58 } from '@/lib/blockchain/tron-address'

/** keccak256("Transfer(address,address,uint256)") */
const TRANSFER_TOPIC = 'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

interface TronLog {
  address?: string
  topics?: string[]
  data?: string
}

interface TronTxInfo {
  id?: string
  blockNumber?: number
  receipt?: { result?: string }
  log?: TronLog[]
  contractResult?: string[]
}

const DEFAULT_API = 'https://api.trongrid.io'
const TIMEOUT_MS = 12_000

async function post<T>(baseUrl: string, path: string, body: unknown, apiKey?: string): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { 'TRON-PRO-API-KEY': apiKey } : {}),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Tron API returned ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Verifies TRC20 transfers by reading the transaction's event log from a
 * Tron node. Reading only: this provider has no signing capability.
 */
export class TronProvider implements ChainProvider {
  readonly chain = 'tron'

  private readonly baseUrl: string
  private readonly apiKey?: string

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || process.env.TRON_API_URL || DEFAULT_API
    this.apiKey = apiKey || process.env.TRON_API_KEY || undefined
  }

  isConfigured(): boolean {
    // TronGrid serves public reads without a key, but rate limits hard.
    // Treat a bare URL as configured and let failures surface as UNAVAILABLE.
    return Boolean(this.baseUrl)
  }

  async getTokenTransfer(
    txHash: string,
    destinationAddresses: string[],
    context: ProviderContext,
  ): Promise<VerificationOutcome> {
    if (!this.isConfigured()) {
      return { status: 'UNAVAILABLE', reason: 'Tron provider is not configured (set TRON_API_URL).' }
    }

    const hash = txHash.trim().replace(/^0x/, '').toLowerCase()
    if (!/^[0-9a-f]{64}$/.test(hash)) {
      return { status: 'REJECTED', reason: 'Malformed Tron transaction hash.', raw: { txHash } }
    }

    let info: TronTxInfo
    let currentBlock: number
    try {
      ;[info, currentBlock] = await Promise.all([
        post<TronTxInfo>(this.baseUrl, '/wallet/gettransactioninfobyid', { value: hash }, this.apiKey),
        this.getCurrentBlock(),
      ])
    } catch (err) {
      return {
        status: 'UNAVAILABLE',
        reason: `Tron node unreachable: ${err instanceof Error ? err.message : 'unknown error'}`,
      }
    }

    if (!info || !info.id) {
      // Not indexed yet: broadcast-but-unmined transactions look like this.
      return { status: 'PENDING', confirmations: 0, required: context.requiredConfirmations, raw: { txHash: hash } }
    }

    if (info.receipt?.result && info.receipt.result !== 'SUCCESS') {
      return {
        status: 'REJECTED',
        reason: `Transaction did not succeed on chain (${info.receipt.result}).`,
        raw: info as unknown as Record<string, unknown>,
      }
    }

    const expectedContract = normaliseTronAddress(context.tokenContract)
    if (!expectedContract) {
      return { status: 'UNAVAILABLE', reason: 'Configured token contract is not a valid Tron address.' }
    }

    const destinations = new Set(
      destinationAddresses.map((a) => normaliseTronAddress(a)).filter((a): a is string => Boolean(a)),
    )
    if (destinations.size === 0) {
      return { status: 'UNAVAILABLE', reason: 'No deposit address is configured for this network.' }
    }

    const logs = info.log ?? []
    let sawTransferToOther = false
    let sawWrongToken = false

    for (const log of logs) {
      const topics = log.topics ?? []
      if (topics.length < 3) continue
      if (topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue

      const logContract = normaliseTronAddress(log.address ?? '')
      if (logContract !== expectedContract) {
        sawWrongToken = true
        continue
      }

      const to = normaliseTronAddress(topics[2]!)
      const from = normaliseTronAddress(topics[1]!)
      if (!to) continue

      if (!destinations.has(to)) {
        sawTransferToOther = true
        continue
      }

      const rawAmount = BigInt(`0x${(log.data || '0').replace(/^0x/, '') || '0'}`)
      if (rawAmount <= 0n) continue

      const blockNumber = info.blockNumber ?? null
      const confirmations = blockNumber && currentBlock ? Math.max(currentBlock - blockNumber + 1, 0) : 0

      const transfer = {
        txHash: hash,
        from: (from && tronHexToBase58(`41${from}`)) || from || 'unknown',
        to: tronHexToBase58(`41${to}`) || to,
        tokenContract: tronHexToBase58(`41${logContract}`) || logContract,
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
          raw: { transfer, blockNumber, currentBlock },
        }
      }

      return { status: 'CONFIRMED', transfer, raw: { blockNumber, currentBlock, logs: logs.length } }
    }

    if (sawWrongToken) {
      return {
        status: 'REJECTED',
        reason: 'The transaction transfers a different token than the one configured for this network.',
        raw: info as unknown as Record<string, unknown>,
      }
    }
    if (sawTransferToOther) {
      return {
        status: 'REJECTED',
        reason: 'The transaction was not sent to a platform deposit address.',
        raw: info as unknown as Record<string, unknown>,
      }
    }

    return {
      status: 'REJECTED',
      reason: 'No matching TRC20 transfer was found in this transaction.',
      raw: info as unknown as Record<string, unknown>,
    }
  }

  private async getCurrentBlock(): Promise<number> {
    const block = await post<{ block_header?: { raw_data?: { number?: number } } }>(
      this.baseUrl,
      '/wallet/getnowblock',
      {},
      this.apiKey,
    )
    return block?.block_header?.raw_data?.number ?? 0
  }
}
