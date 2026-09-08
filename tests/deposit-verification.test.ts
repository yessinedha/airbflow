import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EvmProvider } from '@/lib/blockchain/providers/evm'
import { TronProvider } from '@/lib/blockchain/providers/tron'
import { formatUnits } from '@/lib/blockchain/types'
import type { ProviderContext } from '@/lib/blockchain/types'

/**
 * These providers decide whether real money is credited to a user, so the
 * cases that must never pass are tested as carefully as the happy path:
 * wrong token, wrong destination, reverted transaction, too few
 * confirmations. A `CONFIRMED` result is the only one that leads to a
 * credit, and the amount always comes from the chain, never from the user.
 */

const TRANSFER_TOPIC_EVM = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const TRANSFER_TOPIC_TRON = 'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

function pad(address: string): string {
  return `0x000000000000000000000000${address.replace(/^0x/, '').toLowerCase()}`
}

/** 125 USDT with 6 decimals, as the chain reports it. */
const RAW_125_USDT = (125n * 10n ** 6n).toString(16)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

/* ------------------------------------------------------------------ */
/* Unit scaling                                                        */
/* ------------------------------------------------------------------ */
describe('formatUnits', () => {
  it('scales a raw integer without floating point drift', () => {
    expect(formatUnits('125000000', 6)).toBe(125)
    expect(formatUnits('1', 6)).toBe(0.000001)
    expect(formatUnits('123456789', 6)).toBe(123.456789)
  })

  it('handles 18-decimal tokens', () => {
    expect(formatUnits('1000000000000000000', 18)).toBe(1)
  })

  it('handles zero decimals', () => {
    expect(formatUnits('42', 0)).toBe(42)
  })

  it('returns zero for a zero amount', () => {
    expect(formatUnits('0', 6)).toBe(0)
  })
})

/* ------------------------------------------------------------------ */
/* EVM                                                                 */
/* ------------------------------------------------------------------ */
describe('EvmProvider', () => {
  const RPC = 'https://rpc.example.test'
  const TOKEN = '0xdac17f958d2ee523a2206206994597c13d831ec7'
  const PLATFORM = '0x1111111111111111111111111111111111111111'
  const SENDER = '0x2222222222222222222222222222222222222222'
  const OUTSIDER = '0x3333333333333333333333333333333333333333'
  const HASH = `0x${'a'.repeat(64)}`

  const context: ProviderContext = {
    tokenContract: TOKEN,
    tokenDecimals: 6,
    requiredConfirmations: 12,
  }

  /** Serves eth_getTransactionReceipt / eth_blockNumber from fixtures. */
  function stubRpc(receipt: unknown, headBlock = 200) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        const { method } = JSON.parse(init.body) as { method: string }
        const result = method === 'eth_blockNumber' ? `0x${headBlock.toString(16)}` : receipt
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }),
    )
  }

  function receiptWith(logs: unknown[], blockNumber = 100, status = '0x1') {
    return { status, blockNumber: `0x${blockNumber.toString(16)}`, logs }
  }

  const goodLog = {
    address: TOKEN,
    topics: [TRANSFER_TOPIC_EVM, pad(SENDER), pad(PLATFORM)],
    data: `0x${RAW_125_USDT}`,
  }

  it('confirms a valid transfer and reports the on-chain amount', async () => {
    stubRpc(receiptWith([goodLog]))
    const result = await new EvmProvider('bsc', RPC).getTokenTransfer(HASH, [PLATFORM], context)

    expect(result.status).toBe('CONFIRMED')
    if (result.status !== 'CONFIRMED') return
    expect(result.transfer.amount).toBe(125)
    expect(result.transfer.to).toBe(PLATFORM)
    expect(result.transfer.from).toBe(SENDER)
    expect(result.transfer.tokenContract).toBe(TOKEN)
    expect(result.transfer.confirmations).toBeGreaterThanOrEqual(12)
  })

  it('matches the destination address case-insensitively', async () => {
    stubRpc(receiptWith([goodLog]))
    const result = await new EvmProvider('bsc', RPC).getTokenTransfer(HASH, [PLATFORM.toUpperCase()], context)
    expect(result.status).toBe('CONFIRMED')
  })

  it('rejects a transfer of a different token', async () => {
    const otherToken = '0x9999999999999999999999999999999999999999'
    stubRpc(receiptWith([{ ...goodLog, address: otherToken }]))
    const result = await new EvmProvider('bsc', RPC).getTokenTransfer(HASH, [PLATFORM], context)

    expect(result.status).toBe('REJECTED')
    if (result.status !== 'REJECTED') return
    expect(result.reason).toMatch(/different token/i)
  })

  it('rejects a transfer sent to somebody else', async () => {
    stubRpc(receiptWith([{ ...goodLog, topics: [TRANSFER_TOPIC_EVM, pad(SENDER), pad(OUTSIDER)] }]))
    const result = await new EvmProvider('bsc', RPC).getTokenTransfer(HASH, [PLATFORM], context)

    expect(result.status).toBe('REJECTED')
    if (result.status !== 'REJECTED') return
    expect(result.reason).toMatch(/not sent to a platform deposit address/i)
  })

  it('rejects a reverted transaction', async () => {
    stubRpc(receiptWith([goodLog], 100, '0x0'))
    const result = await new EvmProvider('bsc', RPC).getTokenTransfer(HASH, [PLATFORM], context)

    expect(result.status).toBe('REJECTED')
    if (result.status !== 'REJECTED') return
    expect(result.reason).toMatch(/reverted/i)
  })

  it('rejects a transaction with no transfer event at all', async () => {
    stubRpc(receiptWith([]))
    const result = await new EvmProvider('bsc', RPC).getTokenTransfer(HASH, [PLATFORM], context)
    expect(result.status).toBe('REJECTED')
  })

  it('stays pending while the transaction is not deep enough', async () => {
    stubRpc(receiptWith([goodLog], 198), 200) // 3 confirmations, 12 required
    const result = await new EvmProvider('bsc', RPC).getTokenTransfer(HASH, [PLATFORM], context)

    expect(result.status).toBe('PENDING')
    if (result.status !== 'PENDING') return
    expect(result.confirmations).toBe(3)
    expect(result.required).toBe(12)
  })

  it('stays pending when the transaction is not mined yet', async () => {
    stubRpc(null)
    const result = await new EvmProvider('bsc', RPC).getTokenTransfer(HASH, [PLATFORM], context)
    expect(result.status).toBe('PENDING')
  })

  it('rejects a malformed hash before making any network call', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await new EvmProvider('bsc', RPC).getTokenTransfer('not-a-hash', [PLATFORM], context)

    expect(result.status).toBe('REJECTED')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports UNAVAILABLE, never a credit, when the RPC endpoint fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connection refused')
      }),
    )
    const result = await new EvmProvider('bsc', RPC).getTokenTransfer(HASH, [PLATFORM], context)

    expect(result.status).toBe('UNAVAILABLE')
  })

  it('reports UNAVAILABLE when no deposit address is configured', async () => {
    stubRpc(receiptWith([goodLog]))
    const result = await new EvmProvider('bsc', RPC).getTokenTransfer(HASH, [], context)
    expect(result.status).toBe('UNAVAILABLE')
  })

  it('is not configured when the chain has no RPC endpoint', () => {
    vi.stubEnv('BSC_RPC_URL', '')
    vi.stubEnv('ETH_RPC_URL', '')
    vi.stubEnv('EVM_RPC_URLS', '')
    expect(new EvmProvider('bsc').isConfigured()).toBe(false)
  })

  it('resolves an endpoint from the multi-chain environment variable', () => {
    vi.stubEnv('EVM_RPC_URLS', `polygon=${RPC}/poly,arbitrum=${RPC}/arb`)
    expect(new EvmProvider('polygon').isConfigured()).toBe(true)
    expect(new EvmProvider('avalanche').isConfigured()).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/* Tron                                                                */
/* ------------------------------------------------------------------ */
describe('TronProvider', () => {
  const API = 'https://tron.example.test'
  const TOKEN_BASE58 = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
  const TOKEN_HEX = 'a614f803b6fd780986a42c78ec9c7f77e6ded13c'
  const PLATFORM_BASE58 = 'TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR'
  const PLATFORM_HEX = 'ec8c5a0fcbb28f1d9dd1a4cd1d0a5f4b8b4b1c33'
  const HASH = 'b'.repeat(64)

  const context: ProviderContext = {
    tokenContract: TOKEN_BASE58,
    tokenDecimals: 6,
    requiredConfirmations: 19,
  }

  /** Resolved from the base58 fixture so the test data cannot drift. */
  let platformHex: string

  beforeEach(async () => {
    const { normaliseTronAddress } = await import('@/lib/blockchain/tron-address')
    platformHex = normaliseTronAddress(PLATFORM_BASE58)!
    expect(platformHex).toBeTruthy()
  })

  function stubTron(info: unknown, headBlock = 200) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const body = String(url).includes('getnowblock')
          ? { block_header: { raw_data: { number: headBlock } } }
          : info
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }),
    )
  }

  function infoWith(logs: unknown[], blockNumber = 100, result = 'SUCCESS') {
    return { id: HASH, blockNumber, receipt: { result }, log: logs }
  }

  function transferLog(to: string, contract = TOKEN_HEX, data = RAW_125_USDT) {
    return {
      address: `41${contract}`,
      topics: [
        TRANSFER_TOPIC_TRON,
        `000000000000000000000000${'1'.repeat(40)}`,
        `000000000000000000000000${to}`,
      ],
      data,
    }
  }

  it('confirms a valid TRC20 transfer to a platform address', async () => {
    stubTron(infoWith([transferLog(platformHex)]))
    const result = await new TronProvider(API).getTokenTransfer(HASH, [PLATFORM_BASE58], context)

    expect(result.status).toBe('CONFIRMED')
    if (result.status !== 'CONFIRMED') return
    expect(result.transfer.amount).toBe(125)
    expect(result.transfer.to).toBe(PLATFORM_BASE58)
    expect(result.transfer.tokenContract).toBe(TOKEN_BASE58)
  })

  it('rejects a transfer of a different TRC20 token', async () => {
    stubTron(infoWith([transferLog(platformHex, 'f'.repeat(40))]))
    const result = await new TronProvider(API).getTokenTransfer(HASH, [PLATFORM_BASE58], context)

    expect(result.status).toBe('REJECTED')
    if (result.status !== 'REJECTED') return
    expect(result.reason).toMatch(/different token/i)
  })

  it('rejects a transfer that went to another wallet', async () => {
    stubTron(infoWith([transferLog(PLATFORM_HEX)]))
    const result = await new TronProvider(API).getTokenTransfer(HASH, [PLATFORM_BASE58], context)

    expect(result.status).toBe('REJECTED')
    if (result.status !== 'REJECTED') return
    expect(result.reason).toMatch(/not sent to a platform deposit address/i)
  })

  it('rejects a transaction that failed on chain', async () => {
    stubTron(infoWith([transferLog(platformHex)], 100, 'REVERT'))
    const result = await new TronProvider(API).getTokenTransfer(HASH, [PLATFORM_BASE58], context)
    expect(result.status).toBe('REJECTED')
  })

  it('stays pending below the required confirmation depth', async () => {
    stubTron(infoWith([transferLog(platformHex)], 195), 200) // 6 of 19
    const result = await new TronProvider(API).getTokenTransfer(HASH, [PLATFORM_BASE58], context)

    expect(result.status).toBe('PENDING')
    if (result.status !== 'PENDING') return
    expect(result.confirmations).toBe(6)
    expect(result.required).toBe(19)
  })

  it('stays pending for a transaction the node does not know yet', async () => {
    stubTron({})
    const result = await new TronProvider(API).getTokenTransfer(HASH, [PLATFORM_BASE58], context)
    expect(result.status).toBe('PENDING')
  })

  it('rejects a malformed Tron hash without calling the node', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await new TronProvider(API).getTokenTransfer('0xdeadbeef', [PLATFORM_BASE58], context)

    expect(result.status).toBe('REJECTED')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports UNAVAILABLE when the node cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('timeout')
      }),
    )
    const result = await new TronProvider(API).getTokenTransfer(HASH, [PLATFORM_BASE58], context)
    expect(result.status).toBe('UNAVAILABLE')
  })

  it('ignores a zero-value transfer rather than crediting it', async () => {
    stubTron(infoWith([transferLog(platformHex, TOKEN_HEX, '0')]))
    const result = await new TronProvider(API).getTokenTransfer(HASH, [PLATFORM_BASE58], context)
    expect(result.status).toBe('REJECTED')
  })
})
