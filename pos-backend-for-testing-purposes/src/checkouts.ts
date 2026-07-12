import type { NormalizedPayment } from './types'

/**
 * Pending-checkout store + Square->settlement mapping (Slice 3+4).
 *
 * A completed Square payment becomes a "pending checkout" that the CRE workflow polls via
 * GET /internal/checkouts/pending. Each pending item carries everything SettlementRouter.settle
 * needs: merchant, payer, amount, purpose. The router (not this backend) decides the rail.
 *
 * MVP notes (disclosed):
 *  - This is an in-memory store; a process restart clears pending checkouts. Fine for a demo.
 *  - Square payments carry no on-chain merchant/payer address and no PTSR "purpose" field, so
 *    we derive them from the payment note using a documented convention (see parseCheckoutNote).
 */

export type Purpose = 'RetailGoods' | 'VirtualAssetRelated' | 'CrossBorderB2B'

export interface PendingCheckout {
  checkoutId: string // Square payment id — also the idempotency key
  merchant: `0x${string}`
  payer: `0x${string}`
  amount: string // base units of the rail token the router will select
  purpose: Purpose
}

const PURPOSES: readonly Purpose[] = ['RetailGoods', 'VirtualAssetRelated', 'CrossBorderB2B']
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/
const HEX20 = (v: string): v is `0x${string}` => ADDRESS_REGEX.test(v)

/**
 * Convention for encoding settlement intent in a Square payment note. Square's dashboard/API
 * lets a note be attached at checkout, so we use a structured, parseable form:
 *
 *   sila-layer:merchant=0x...;payer=0x...;purpose=RetailGoods;amount=1000000
 *
 * All four keys are required. `purpose` must be one of the PTSR purposes. `amount` is optional;
 * if omitted we fall back to the payment's own amount (amountMinor). This keeps the demo simple
 * while being explicit about what drives on-chain settlement.
 */
export const parseCheckoutNote = (
  payment: NormalizedPayment,
): PendingCheckout | { error: string } => {
  const note = payment.note ?? ''
  const marker = 'sila-layer:'
  const idx = note.indexOf(marker)
  if (idx < 0) {
    return { error: 'note missing sila-layer: settlement directive' }
  }

  const spec = note.slice(idx + marker.length).trim()
  const kv = new Map<string, string>()
  for (const part of spec.split(';')) {
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    kv.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim())
  }

  const merchant = kv.get('merchant') ?? ''
  const payer = kv.get('payer') ?? ''
  const purposeRaw = kv.get('purpose') ?? ''
  const amount = kv.get('amount') ?? payment.amountMinor.toString()

  if (!HEX20(merchant)) return { error: `invalid or missing merchant address: "${merchant}"` }
  if (!HEX20(payer)) return { error: `invalid or missing payer address: "${payer}"` }
  if (!PURPOSES.includes(purposeRaw as Purpose)) {
    return { error: `invalid or missing purpose: "${purposeRaw}"` }
  }
  if (!/^\d+$/.test(amount) || amount === '0') {
    return { error: `invalid amount: "${amount}"` }
  }

  return {
    checkoutId: payment.id,
    merchant,
    payer,
    amount,
    purpose: purposeRaw as Purpose,
  }
}

type CheckoutState = 'pending' | 'settled' | 'failed'

interface StoredCheckout extends PendingCheckout {
  state: CheckoutState
  txHash?: string
  lastError?: string
}

/** In-memory pending-checkout store, keyed by Square payment id (idempotent on re-delivery). */
export class CheckoutStore {
  private readonly items = new Map<string, StoredCheckout>()

  /** Record a completed Square payment as a pending checkout. No-op if already known. */
  addFromPayment(payment: NormalizedPayment): PendingCheckout | { error: string } {
    if (this.items.has(payment.id)) {
      const existing = this.items.get(payment.id)!
      return existing
    }
    const parsed = parseCheckoutNote(payment)
    if ('error' in parsed) return parsed
    this.items.set(parsed.checkoutId, { ...parsed, state: 'pending' })
    return parsed
  }

  /** The list the CRE workflow polls. */
  listPending(limit: number): PendingCheckout[] {
    const out: PendingCheckout[] = []
    for (const item of this.items.values()) {
      if (item.state !== 'pending') continue
      const { state, txHash, lastError, ...pending } = item
      out.push(pending)
      if (out.length >= limit) break
    }
    return out
  }

  /** Record the workflow's on-chain outcome so a settled checkout is not re-submitted. */
  recordResult(checkoutId: string, outcome: 'SUCCESS' | 'RETRYABLE', txHash?: string, errorMessage?: string): boolean {
    const item = this.items.get(checkoutId)
    if (!item) return false
    if (outcome === 'SUCCESS') {
      item.state = 'settled'
      item.txHash = txHash
    } else {
      // Retryable: keep it pending so the next cron run re-submits.
      item.state = 'pending'
      item.lastError = errorMessage
    }
    return true
  }

  get(checkoutId: string): StoredCheckout | undefined {
    return this.items.get(checkoutId)
  }

  /** Test/demo helper: seed a pending checkout directly. */
  seed(checkout: PendingCheckout): void {
    this.items.set(checkout.checkoutId, { ...checkout, state: 'pending' })
  }
}
