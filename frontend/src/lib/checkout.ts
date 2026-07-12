// Mock checkout-detail service.
// TODO: replace this with a real fetch to the POS backend once a customer-facing
// GET /checkouts/:checkoutId endpoint exists.

export type Purpose = "RetailGoods" | "VirtualAssetRelated" | "CrossBorderB2B";

export interface CheckoutDetails {
  checkoutId: string;
  merchantAddress: `0x${string}`;
  merchantLabel: string;
  amountAed: number;
  purpose: Purpose;
}

const purposeIndex: Record<Purpose, number> = {
  RetailGoods: 0,
  VirtualAssetRelated: 1,
  CrossBorderB2B: 2,
};

export function purposeToUint8(purpose: Purpose): number {
  return purposeIndex[purpose];
}

const MOCK_CHECKOUTS: Record<string, CheckoutDetails> = {
  "demo-mainland": {
    checkoutId: "demo-mainland",
    merchantAddress: "0x1111111111111111111111111111111111111111",
    merchantLabel: "Al Khan Cafe",
    amountAed: 150.0,
    purpose: "RetailGoods",
  },
  "demo-difc": {
    checkoutId: "demo-difc",
    merchantAddress: "0x2222222222222222222222222222222222222222",
    merchantLabel: "DIFC Tech Hub",
    amountAed: 2500.0,
    purpose: "CrossBorderB2B",
  },
};

export async function getCheckoutDetails(
  checkoutId: string,
): Promise<CheckoutDetails> {
  // Simulate network latency.
  await new Promise((resolve) => setTimeout(resolve, 300));
  const checkout = MOCK_CHECKOUTS[checkoutId];
  if (!checkout) {
    // Fallback so any URL is demo-able.
    return {
      checkoutId,
      merchantAddress: "0x1111111111111111111111111111111111111111",
      merchantLabel: "Demo Merchant",
      amountAed: 100.0,
      purpose: "RetailGoods",
    };
  }
  return checkout;
}

// Placeholder for notifying the backend that the customer confirmed payment.
// In the real flow the CRE workflow polls the backend and submits SettlementRouter.settle.
export async function notifyBackendCheckoutComplete(
  checkoutId: string,
): Promise<void> {
  // TODO: POST to the POS backend checkout-complete endpoint when one exists.
  console.log("Checkout confirmed:", checkoutId);
  await new Promise((resolve) => setTimeout(resolve, 400));
}
