import { describe, expect, it } from 'vitest'
import { normaliseTronAddress, tronBase58ToHex, tronHexToBase58 } from '@/lib/blockchain/tron-address'

/**
 * Address handling is a money-safety boundary: if two encodings of the same
 * address failed to compare equal we would reject genuine deposits, and if
 * an invalid address decoded successfully we could credit a transfer that
 * went to somebody else's wallet.
 */

// Real, well-known mainnet values.
const USDT_TRC20_BASE58 = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
const USDT_TRC20_HEX = '41a614f803b6fd780986a42c78ec9c7f77e6ded13c'

describe('tronBase58ToHex', () => {
  it('decodes a valid base58 address to 41-prefixed hex', () => {
    expect(tronBase58ToHex(USDT_TRC20_BASE58)).toBe(USDT_TRC20_HEX)
  })

  it('tolerates surrounding whitespace', () => {
    expect(tronBase58ToHex(`  ${USDT_TRC20_BASE58}\n`)).toBe(USDT_TRC20_HEX)
  })

  it('rejects an address whose checksum does not match', () => {
    // Flip the final character: the payload still decodes, the checksum fails.
    const tampered = `${USDT_TRC20_BASE58.slice(0, -1)}u`
    expect(tronBase58ToHex(tampered)).toBeNull()
  })

  it('rejects characters outside the base58 alphabet', () => {
    expect(tronBase58ToHex('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj60')).toBeNull()
    expect(tronBase58ToHex('not-an-address')).toBeNull()
  })

  it('rejects an empty string', () => {
    expect(tronBase58ToHex('')).toBeNull()
    expect(tronBase58ToHex('   ')).toBeNull()
  })

  it('rejects a payload of the wrong length', () => {
    expect(tronBase58ToHex('TR7NHqjeKQxGTCi8')).toBeNull()
  })
})

describe('tronHexToBase58', () => {
  it('round-trips a 41-prefixed hex address', () => {
    expect(tronHexToBase58(USDT_TRC20_HEX)).toBe(USDT_TRC20_BASE58)
  })

  it('adds the 41 prefix to a bare 20-byte address', () => {
    expect(tronHexToBase58(USDT_TRC20_HEX.slice(2))).toBe(USDT_TRC20_BASE58)
  })

  it('accepts a 0x prefix and mixed case', () => {
    expect(tronHexToBase58(`0x${USDT_TRC20_HEX.toUpperCase()}`)).toBe(USDT_TRC20_BASE58)
  })

  it('rejects malformed hex', () => {
    expect(tronHexToBase58('41zzzz')).toBeNull()
    expect(tronHexToBase58('')).toBeNull()
  })
})

describe('normaliseTronAddress', () => {
  const bare = USDT_TRC20_HEX.slice(2)

  it('maps every encoding of the same address to one value', () => {
    expect(normaliseTronAddress(USDT_TRC20_BASE58)).toBe(bare)
    expect(normaliseTronAddress(USDT_TRC20_HEX)).toBe(bare)
    expect(normaliseTronAddress(bare)).toBe(bare)
    expect(normaliseTronAddress(`0x${bare}`)).toBe(bare)
  })

  it('extracts the address from a 32-byte event-log topic', () => {
    const topic = `000000000000000000000000${bare}`
    expect(normaliseTronAddress(topic)).toBe(bare)
  })

  it('is case insensitive', () => {
    expect(normaliseTronAddress(bare.toUpperCase())).toBe(bare)
  })

  it('returns null rather than guessing for unusable input', () => {
    expect(normaliseTronAddress('')).toBeNull()
    expect(normaliseTronAddress('T-invalid')).toBeNull()
    expect(normaliseTronAddress('deadbeef')).toBeNull()
  })

  it('never treats two different addresses as equal', () => {
    const other = 'TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR'
    expect(normaliseTronAddress(other)).not.toBe(normaliseTronAddress(USDT_TRC20_BASE58))
  })
})
