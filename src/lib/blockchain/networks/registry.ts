import 'server-only'

import type { ChainProvider } from '@/lib/blockchain/types'
import { TronProvider } from '@/lib/blockchain/providers/tron'
import { EvmProvider } from '@/lib/blockchain/providers/evm'

/**
 * Maps the `chain` column of `supported_networks` to a verification
 * provider. Adding a chain is a database row plus, if it is not
 * EVM-compatible, one new provider class here. Nothing is hard-coded in
 * the deposit flow itself.
 */

const EVM_CHAINS = new Set([
  'ethereum',
  'eth',
  'mainnet',
  'bsc',
  'bnb',
  'binance',
  'polygon',
  'matic',
  'arbitrum',
  'optimism',
  'avalanche',
  'base',
])

const cache = new Map<string, ChainProvider>()

export function getProviderForChain(chain: string): ChainProvider | null {
  const key = chain.trim().toLowerCase()
  const cached = cache.get(key)
  if (cached) return cached

  let provider: ChainProvider | null = null

  if (key === 'tron' || key === 'trx') {
    provider = new TronProvider()
  } else if (EVM_CHAINS.has(key)) {
    provider = new EvmProvider(key)
  }

  if (provider) cache.set(key, provider)
  return provider
}

/** Used by /admin to show which chains can currently be verified. */
export function providerStatus(chain: string): { supported: boolean; configured: boolean } {
  const provider = getProviderForChain(chain)
  if (!provider) return { supported: false, configured: false }
  return { supported: true, configured: provider.isConfigured() }
}

/** Test seam: lets integration tests substitute a fake provider. */
export function registerProvider(chain: string, provider: ChainProvider): void {
  cache.set(chain.trim().toLowerCase(), provider)
}

export function clearProviderCache(): void {
  cache.clear()
}
