import { createHash } from 'node:crypto'

/**
 * Base58Check helpers for Tron addresses.
 *
 * Tron shows addresses as base58 ("T..."), but the node API reports log
 * topics and contract addresses as 41-prefixed hex. Comparing a configured
 * deposit address against a log therefore needs a conversion, and it must
 * be exact: a sloppy comparison here would mean crediting a deposit that
 * went to somebody else's wallet.
 */

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const ALPHABET_MAP = new Map<string, number>()
for (let i = 0; i < ALPHABET.length; i++) ALPHABET_MAP.set(ALPHABET[i]!, i)

function sha256(buf: Buffer): Buffer {
  return createHash('sha256').update(buf).digest()
}

function base58Decode(input: string): Buffer | null {
  if (!input || input.length === 0) return null

  let num = 0n
  for (const char of input) {
    const digit = ALPHABET_MAP.get(char)
    if (digit === undefined) return null
    num = num * 58n + BigInt(digit)
  }

  let hex = num.toString(16)
  if (hex.length % 2) hex = `0${hex}`
  let bytes = Buffer.from(hex, 'hex')

  // Restore leading zero bytes, which base58 encodes as '1'.
  let leadingZeros = 0
  for (const char of input) {
    if (char === '1') leadingZeros++
    else break
  }
  if (leadingZeros > 0) bytes = Buffer.concat([Buffer.alloc(leadingZeros, 0), bytes])

  return bytes
}

function base58Encode(bytes: Buffer): string {
  let num = BigInt(`0x${bytes.toString('hex') || '0'}`)
  let out = ''
  while (num > 0n) {
    const rem = Number(num % 58n)
    num = num / 58n
    out = ALPHABET[rem] + out
  }
  for (const byte of bytes) {
    if (byte === 0) out = `1${out}`
    else break
  }
  return out
}

/**
 * Converts a base58 Tron address to its 21-byte hex form (41 + 20 bytes),
 * validating the base58check checksum. Returns null for anything invalid.
 */
export function tronBase58ToHex(address: string): string | null {
  const decoded = base58Decode(address.trim())
  if (!decoded || decoded.length !== 25) return null

  const payload = decoded.subarray(0, 21)
  const checksum = decoded.subarray(21)
  const expected = sha256(sha256(payload)).subarray(0, 4)

  if (!checksum.equals(expected)) return null
  if (payload[0] !== 0x41) return null

  return payload.toString('hex').toLowerCase()
}

/** Converts a 41-prefixed (or bare 20-byte) hex address back to base58. */
export function tronHexToBase58(hex: string): string | null {
  let clean = hex.trim().toLowerCase().replace(/^0x/, '')
  if (clean.length === 40) clean = `41${clean}`
  if (clean.length !== 42 || !/^[0-9a-f]+$/.test(clean)) return null

  const payload = Buffer.from(clean, 'hex')
  const checksum = sha256(sha256(payload)).subarray(0, 4)
  return base58Encode(Buffer.concat([payload, checksum]))
}

/**
 * Normalises anything Tron-shaped to bare lowercase 20-byte hex so two
 * representations of the same address compare equal.
 */
export function normaliseTronAddress(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('T')) {
    const hex = tronBase58ToHex(trimmed)
    return hex ? hex.slice(2) : null
  }

  const clean = trimmed.toLowerCase().replace(/^0x/, '')
  if (clean.length === 42 && clean.startsWith('41')) return clean.slice(2)
  if (clean.length === 40 && /^[0-9a-f]+$/.test(clean)) return clean
  if (clean.length === 64) return clean.slice(24) // 32-byte log topic
  return null
}
