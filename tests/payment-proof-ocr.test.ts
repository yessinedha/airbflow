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

const phoneOcr = `
19:36
Détails du retrait
-8 USDT
Terminé
Réseau TRX
Adresse TGz8WC5CMHrW1uLvgWv7zXz (5!
H94rYwNrrok
Enregistrer l'adresse.
TXID Transfert hors de la blockchain a
418927323402
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
      addressMatch: 'exact',
      transactionType: 'unknown',
    })
  })

  it('accepts a close OCR address reading and identifies a Binance off-chain reference', () => {
    const result = parsePaymentProofOcr(phoneOcr, expected)

    expect(result.issues).toEqual([])
    expect(result.data).toMatchObject({
      addressMatched: true,
      addressMatch: 'approximate',
      transactionType: 'binance_transfer',
      txHash: null,
      binanceTransferId: '418927323402',
    })
  })

  it('recognises a real 64-character on-chain transaction hash separately', () => {
    const txHash = 'a1b2c3d4'.repeat(8)
    const result = parsePaymentProofOcr(
      receipt.replace('Date 2026-10-08', `TXID ${txHash}\nDate 2026-10-08`),
      expected,
    )

    expect(result.data.transactionType).toBe('onchain')
    expect(result.data.txHash).toBe(txHash)
    expect(result.data.binanceTransferId).toBeNull()
  })

  it('rejects proof text that does not match the declared amount or destination', () => {
    const result = parsePaymentProofOcr(
      receipt.replace('-8 USDT', '-80 USDT').replace(
        'TGz8WC5CMHrW1ULvGgW7zXz H94rYwNrrok',
        `T${'1'.repeat(33)}`,
      ),
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
