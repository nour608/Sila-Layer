import { describe, expect, it } from 'vitest'
import { CheckoutStore, parseCheckoutNote } from '../../src/checkouts'
import type { NormalizedPayment } from '../../src/types'

const payment = (note: string | undefined, over: Partial<NormalizedPayment> = {}): NormalizedPayment => ({
  id: over.id ?? 'sq-pay-1',
  amountMinor: over.amountMinor ?? 1000000n,
  currency: 'USD',
  status: over.status ?? 'COMPLETED',
  createdAt: '2026-07-08T00:00:00Z',
  note,
  raw: {},
  ...over,
})

const M = '0x1111111111111111111111111111111111111111'
const P = '0x2222222222222222222222222222222222222222'

describe('parseCheckoutNote', () => {
  it('parses a well-formed directive', () => {
    const r = parseCheckoutNote(payment(`order ref - sila-layer:merchant=${M};payer=${P};purpose=RetailGoods;amount=500`))
    expect('error' in r).toBe(false)
    if ('error' in r) return
    expect(r.merchant).toBe(M)
    expect(r.payer).toBe(P)
    expect(r.purpose).toBe('RetailGoods')
    expect(r.amount).toBe('500')
    expect(r.checkoutId).toBe('sq-pay-1')
  })

  it('falls back to payment amount when amount omitted', () => {
    const r = parseCheckoutNote(payment(`sila-layer:merchant=${M};payer=${P};purpose=VirtualAssetRelated`))
    if ('error' in r) throw new Error(r.error)
    expect(r.amount).toBe('1000000')
    expect(r.purpose).toBe('VirtualAssetRelated')
  })

  it('rejects a missing directive', () => {
    expect(parseCheckoutNote(payment('just a normal note'))).toHaveProperty('error')
    expect(parseCheckoutNote(payment(undefined))).toHaveProperty('error')
  })

  it('rejects invalid addresses and purpose', () => {
    expect(parseCheckoutNote(payment(`sila-layer:merchant=0xbad;payer=${P};purpose=RetailGoods`))).toHaveProperty('error')
    expect(parseCheckoutNote(payment(`sila-layer:merchant=${M};payer=${P};purpose=Bogus`))).toHaveProperty('error')
  })
})

describe('CheckoutStore', () => {
  it('adds a completed payment and lists it as pending', () => {
    const store = new CheckoutStore()
    const r = store.addFromPayment(payment(`sila-layer:merchant=${M};payer=${P};purpose=RetailGoods;amount=500`))
    expect('error' in r).toBe(false)
    expect(store.listPending(10)).toHaveLength(1)
  })

  it('is idempotent on re-delivery of the same payment id', () => {
    const store = new CheckoutStore()
    const note = `sila-layer:merchant=${M};payer=${P};purpose=RetailGoods;amount=500`
    store.addFromPayment(payment(note))
    store.addFromPayment(payment(note))
    expect(store.listPending(10)).toHaveLength(1)
  })

  it('removes from pending on SUCCESS result', () => {
    const store = new CheckoutStore()
    store.addFromPayment(payment(`sila-layer:merchant=${M};payer=${P};purpose=RetailGoods;amount=500`))
    expect(store.recordResult('sq-pay-1', 'SUCCESS', '0xabc')).toBe(true)
    expect(store.listPending(10)).toHaveLength(0)
    expect(store.get('sq-pay-1')?.state).toBe('settled')
  })

  it('keeps pending on RETRYABLE result', () => {
    const store = new CheckoutStore()
    store.addFromPayment(payment(`sila-layer:merchant=${M};payer=${P};purpose=RetailGoods;amount=500`))
    store.recordResult('sq-pay-1', 'RETRYABLE', undefined, 'EVM_WRITE_FAILED')
    expect(store.listPending(10)).toHaveLength(1)
  })

  it('returns false for unknown checkout result', () => {
    const store = new CheckoutStore()
    expect(store.recordResult('nope', 'SUCCESS')).toBe(false)
  })

  it('respects the limit', () => {
    const store = new CheckoutStore()
    for (let i = 0; i < 5; i++) {
      store.seed({ checkoutId: `c${i}`, merchant: M, payer: P, amount: '1', purpose: 'RetailGoods' })
    }
    expect(store.listPending(2)).toHaveLength(2)
  })
})
