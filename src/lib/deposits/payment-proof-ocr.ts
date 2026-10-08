export interface PaymentProofOcr {
  amount: string
  network: string
  status: string
  date: string
  addressMatched: boolean
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

export function parsePaymentProofOcr(
  rawText: string,
  expected: PaymentProofExpectations,
): { data: PaymentProofOcr; issues: PaymentProofOcrIssue[] } {
  const text = normaliseText(rawText)
  const amount = extractAmount(rawText)
  const foundNetwork = text.match(/\b(trx|tron|trc[\s-]?20|bsc|bnb|bep[\s-]?20|ethereum|eth|erc[\s-]?20)\b/i)?.[1] ?? ''
  const status = text.match(/\b(termine|complete|completed|success|successful)\b/i)?.[1] ?? ''
  const date = rawText.match(/\b\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?\b/)?.[0] ?? ''
  const addressInText = rawText.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const addressMatched =
    Boolean(expected.address) && addressInText.includes(expected.address.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())
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
      rawText: rawText.slice(0, 10_000),
    },
    issues,
  }
}
