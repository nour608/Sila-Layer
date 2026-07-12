# Sila Layer Frontend

Next.js (App Router) customer payment screen, merchant dashboard, and demo admin panel.

## Pages

- `/` — landing with links to demo flows
- `/pay/[checkoutId]` — consumer payment confirmation screen (neobank-style, no crypto UI)
- `/dashboard` — merchant settlement dashboard reading `Settled` events directly from chain
- `/admin` — demo control panel for seeding vault liquidity and registering test merchants

## Setup

```bash
cd frontend
npm install
cp .env.sample .env.local
# Fill in deployed Amoy addresses and your Privy app ID
npm run dev
```

## Important implementation notes

- Privy is loaded with `ssr: false` via `DynamicPrivyProvider` to avoid hydration errors.
- Sponsored transactions use `sendTransaction(tx, { sponsor: true })` per the installed `@privy-io/react-auth@3.34.0` API.
- The customer approve cap is bounded at `SPONSORED_APPROVE_CAP_USDC` (500 USDC); it is never `type(uint256).max`.
- `/pay/[checkoutId]` uses a mock checkout service (`src/lib/checkout.ts`) for demo URLs. Replace with a real backend endpoint when available.
- The Confirm button currently signals intent via a placeholder backend call and then polls for the on-chain `Settled` event.
