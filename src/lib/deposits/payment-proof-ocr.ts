export interface PaymentProofOcr {
  amount: string
  network: string
  status: string
  date: string
  addressMatched: boolean
  addressMatch: 'exact' | 'approximate' | 'none'
  transactionType: 'onchain' | 'binance_transfer' | 'unknown'
  txHash: string | null
  binanceTransferId: string | null
  rawText: string
}

export interface PaymentProofExpectations {
  amount: string
  networkCode: string
  address: string
}

export type PaymentProofOcrIssue = 'amount' | 'amountMismatch' | 'network' | 'address' | 'status' | 'date'

function normaliseText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function parseAmount(value: string): number | null {
  const compact = value.replace(/\s/g, '')
  const normalised = compact.includes(',')
    ? compact.includes('.')
      ? compact.lastIndexOf(',') > compact.lastIndexOf('.')
        ? compact.replace(/\./g, '').replace(',', '.')
        : compact.replace(/,/g, '')
      : compact.replace(',', '.')
    : compact
  const amount = Number(normalised)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function extractAmount(text: string): string {
  const summaryAmount = text.match(/[-−]\s*([\d][\d\s.,]*)\s*USDT\b/i)?.[1]
  const labeledAmount = text.match(/(?:montant|amount)[\s\S]{0,32}?([\d][\d\s.,]*)\s*USDT\b/i)?.[1]
  const anyAmount = text.match(/([\d][\d\s.,]*)\s*USDT\b/i)?.[1]
  const value = summaryAmount ?? labeledAmount ?? anyAmount
  if (!value) return ''

  const parsed = parseAmount(value)
  return parsed === null ? '' : String(Number(parsed.toFixed(8)))
}

function networkMatches(found: string, expectedCode: string): boolean {
  const actual = found.toUpperCase().replace(/[\s-]/g, '')
  const expected = expectedCode.toUpperCase().replace(/[\s-]/g, '')
  const aliases: Record<string, string[]> = {
    TRC20: ['TRX', 'TRON', 'TRC20'],
    BEP20: ['BSC', 'BNB', 'BEP20'],
    ERC20: ['ETH', 'ETHEREUM', 'ERC20'],
  }
  return (aliases[expected] ?? [expected]).includes(actual)
}

function minimumSubstringEditDistance(value: string, candidate: string): number {
  let previous = Array.from({ length: candidate.length + 1 }, () => 0)

  for (let row = 1; row <= value.length; row += 1) {
    const current = Array.from({ length: candidate.length + 1 }, (_, column) =>
      column === 0 ? row : 0,
    )
    for (let column = 1; column <= candidate.length; column += 1) {
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + (value[row - 1] === candidate[column - 1] ? 0 : 1),
      )
    }
    previous = current
  }

  return Math.min(...previous)
}

function matchAddress(rawText: string, expectedAddress: string): PaymentProofOcr['addressMatch'] {
  if (!expectedAddress) return 'none'

  const normalizedExpected = expectedAddress.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const normalizedText = normaliseText(rawText)
  const addressLabel = /\b(?:adresse|address)\b/.exec(normalizedText)
  if (!addressLabel) return 'none'

  const afterLabel = normalizedText.slice(addressLabel.index + addressLabel[0].length)
  const nextField = /\b(?:enregistrer|save|txid|montant|amount|date|reseau|network|frais|fee)\b/.exec(afterLabel)
  const candidate = (nextField ? afterLabel.slice(0, nextField.index) : afterLabel)
    .replace(/[^a-z0-9]/g, '')
    .toUpperCase()
  if (candidate.includes(normalizedExpected)) return 'exact'

  // OCR can confuse a few glyphs or insert punctuation/noise in long addresses.
  // This is only a submission aid; an administrator still verifies the proof.
  return minimumSubstringEditDistance(normalizedExpected, candidate) <= 3 ? 'approximate' : 'none'
}

function extractTransactionReference(rawText: string): Pick<
  PaymentProofOcr,
  'transactionType' | 'txHash' | 'binanceTransferId'
> {
  const text = normaliseText(rawText)
  const txidIndex = text.search(/\btxid\b/)
  const txidSection = txidIndex >= 0 ? text.slice(txidIndex, txidIndex + 180) : text
  const txHash = txidSection.match(/\b[a-f0-9]{64}\b/i)?.[0] ?? null
  if (txHash) {
    return { transactionType: 'onchain', txHash, binanceTransferId: null }
  }

  const offchainMarker = /\btransfert\s+hors\s+de\s+la\s+blockchain\b/.exec(text)
  if (offchainMarker) {
    const reference = text
      .slice(offchainMarker.index + offchainMarker[0].length, offchainMarker.index + offchainMarker[0].length + 120)
      .match(/\b\d{8,20}\b/)?.[0] ?? null
    if (reference) {
      return { transactionType: 'binance_transfer', txHash: null, binanceTransferId: reference }
    }
  }

  return { transactionType: 'unknown', txHash: null, binanceTransferId: null }
}

export function parsePaymentProofOcr(
  rawText: string,
  expected: PaymentProofExpectations,
): { data: PaymentProofOcr; issues: PaymentProofOcrIssue[] } {
  const text = normaliseText(rawText)
  const amount = extractAmount(rawText)
  const foundNetwork = text.match(/\b(trx|tron|trc[\s-]?20|bsc|bnb|bep[\s-]?20|ethereum|eth|erc[\s-]?20)\b/i)?.[1] ?? ''
  const status = text.match(/\b(termine|complete|completed|success|successful)\b/i)?.[1] ?? ''
  const date = rawText.match(/\b\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?\b/)?.[0] ?? ''
  const addressMatch = matchAddress(rawText, expected.address)
  const addressMatched = addressMatch !== 'none'
  const transactionReference = extractTransactionReference(rawText)
  const issues: PaymentProofOcrIssue[] = []

  if (!amount) issues.push('amount')
  else if (Math.abs(Number(amount) - Number(expected.amount)) > 0.00000001) issues.push('amountMismatch')
  if (!foundNetwork || !networkMatches(foundNetwork, expected.networkCode)) issues.push('network')
  if (!addressMatched) issues.push('address')
  if (!status) issues.push('status')
  if (!date || !Number.isFinite(Date.parse(date))) issues.push('date')

  return {
    data: {
      amount,
      network: foundNetwork.toUpperCase(),
      status,
      date,
      addressMatched,
      addressMatch,
      ...transactionReference,
      rawText: rawText.slice(0, 10_000),
    },
    issues,
  }
}
