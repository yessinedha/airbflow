import { describe, expect, it } from 'vitest'
import { parsePaymentProofOcr } from '../src/lib/deposits/payment-proof-ocr'

const expected = {
  amount: '8',
  networkCode: 'TRC20',
  address: 'TGz8WC5CMHrW1ULvGgW7zXzH94rYwNrrok',
}

const receipt = `
-8 USDT
Terminé
Réseau TRX
Adresse TGz8WC5CMHrW1ULvGgW7zXz H94rYwNrrok
Montant 8 USDT
Date 2026-10-08 14:38:19
`

describe('parsePaymentProofOcr', () => {
  it('recognises the Binance TRX withdrawal-details example', () => {
    const result = parsePaymentProofOcr(receipt, expected)

    expect(result.issues).toEqual([])
    expect(result.data).toMatchObject({
      amount: '8',
      network: 'TRX',
      status: 'termine',
      date: '2026-10-08 14:38:19',
      addressMatched: true,
    })
  })

  it('rejects proof text that does not match the declared amount or destination', () => {
    const result = parsePaymentProofOcr(
      receipt.replace('-8 USDT', '-80 USDT').replace('TGz8WC5CMHrW1ULvGgW7zXz', 'TGz8WC5CMHrW1ULvGgW7zXy'),
      expected,
    )

    expect(result.issues).toContain('amountMismatch')
    expect(result.issues).toContain('address')
  })

  it('accepts common network aliases for TRC20 deposits', () => {
    expect(parsePaymentProofOcr(receipt.replace('Réseau TRX', 'Network TRON'), expected).issues).toEqual([])
    expect(parsePaymentProofOcr(receipt.replace('Réseau TRX', 'Network TRC20'), expected).issues).toEqual([])
  })
})
