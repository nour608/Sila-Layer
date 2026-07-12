# Sila Layer

**Compliance-aware stablecoin settlement infrastructure for UAE merchants.**

Sila Layer is a B2B settlement router: it lets a merchant's point-of-sale accept stablecoin payments while automatically routing each transaction to the settlement rail that's actually legal for that merchant — a licensed AED-pegged Dirham Payment Token where CBUAE's Payment Token Services Regulation (PTSR) requires it, or a foreign payment token (USDC) where PTSR permits it. The merchant never has to understand the regulation to be compliant with it.

Built for the DIFC/Ignyte "Merchant Payments Need a Blockchain-Native Layer" hackathon track, on Polygon Amoy testnet.

> **This is a routing/orchestration layer. It makes no licensing claim and performs no KYC.** See Disclosures below before reading anything else in this document as a claim of production-readiness.

---

## How it works

1. A customer pays a merchant in whatever stablecoin their wallet holds (USDC, in this MVP).
2. `SettlementRouter` asks `MerchantRegistry` whether a foreign payment token is permitted for this merchant + transaction purpose.
3. If the payer's asset doesn't match the required rail, `ConversionVault` converts it before settlement — atomically; it either completes in full or reverts, never partially settles.
4. The merchant receives the one asset PTSR actually allows them to hold. A `Settled` event is emitted with the rail, amounts, purpose, and a human-readable reason string — that string is the audit trail, and it's what's displayed verbatim on the merchant dashboard.

| Zone     | Purpose             | Required rail | Basis                                                                        |
| -------- | ------------------- | ------------- | ---------------------------------------------------------------------------- |
| Mainland | RetailGoods         | AED-PT        | Foreign payment tokens not permitted for retail goods on mainland UAE (PTSR) |
| Mainland | VirtualAssetRelated | USDC          | PTSR carve-out for virtual-asset-related transactions                        |
| Mainland | CrossBorderB2B      | USDC          | Treated as foreign-token-permitted under PTSR                                |
| DIFC     | any                 | USDC          | DIFC sits outside PTSR's direct scope                                        |

## Repository structure

```
smart-contracts/    Foundry project — contracts, tests, deploy scripts
cre-workflows/       Chainlink CRE workflows (TypeScript SDK)
pos-backend-for-testing-purposes/   Square sandbox integration + pending-checkout API the CRE workflow polls
frontend/            Next.js app — landing page, merchant dashboard, docs, admin tools
```

### `smart-contracts/`

| Contract                                                 | Responsibility                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MerchantRegistry.sol`                                   | Source of truth for merchant zone (Mainland/DIFC), active status, and the `isForeignTokenPermitted(merchant, purpose)` compliance check. Registration is owner/registrar-attested for this MVP — **not** a KYC or licensing verification.                                                                              |
| `SettlementRouter.sol`                                   | Entry point for every payment. Reads the registry to pick the rail, calls `ConversionVault` if the payer's asset doesn't match, transfers to the merchant, emits `Settled`. Reverts with named errors on unregistered/inactive merchants or insufficient vault liquidity — never silently settles in the wrong asset.  |
| `ConversionVault.sol`                                    | Seeded testnet liquidity pool swapping between AED-PT and USDC at an owner-set rate. Handles the 2-decimal (AED-PT) vs 6-decimal (USDC) conversion explicitly. **Not a DEX or market maker** — demo-only, disclosed as such.                                                                                           |
| `MockAEDPT.sol`                                          | Simulated AED-pegged token (2 decimals). Stands in for a CBUAE-licensed Dirham Payment Token (e.g. AE Coin) — no public AE Coin developer sandbox exists to integrate against.                                                                                                                                         |
| `SettlementReceiver.sol`, `MerchantRegistryReceiver.sol` | CRE adapters (`IReceiver`). CRE cannot call arbitrary functions — it delivers DON-signed reports to `onReport()` on these receivers via the KeystoneForwarder, which then forward to the already-tested router/registry. This keeps the audited settlement logic frozen and separate from the CRE integration surface. |

Test suite includes fuzz and invariant tests (`SettlementRouter.fuzz.t.sol`, `SettlementRouter.invariant.t.sol`, `ConversionVault.t.sol`) — run with `forge test`.

### `cre-workflows/`

Two Chainlink CRE workflows (TypeScript SDK), cron-triggered:

- `settlement-workflow` — polls the backend's pending-checkouts endpoint, submits DON-signed settlement reports to `SettlementReceiver`.
- `kyb-workflow` — submits DON-signed merchant registration reports to `MerchantRegistryReceiver`.

Both are built against `polygon-testnet-amoy`. If Chainlink CRE Early Access is unavailable at demo time, a Node.js fallback relayer performing the same polling/write pattern is the documented contingency — disclose which path was actually used.

### `pos-backend-for-testing-purposes/`

A small service integrating Square's sandbox API, exposing the `pending checkouts` / `onchain-result` endpoints the CRE workflow calls. Name is intentionally explicit: this stands in for a merchant's real POS backend for demo purposes.

### `frontend/`

Next.js app: interactive routing demo on the landing page, merchant dashboard (balances + settlement ledger with the reason string surfaced), `/docs` (architecture, regulatory model, roadmap), and an `/admin` page for seeding vault liquidity and registering demo merchants — not a production merchant-onboarding flow.

## Running locally

```bash
# Contracts
cd smart-contracts && forge install && forge test

# CRE workflow (from cre-workflows/settlement-workflow)
bun install
cre workflow simulate ./settlement-workflow --target staging-settings --non-interactive --trigger-index 0

# POS backend
cd pos-backend-for-testing-purposes && cp env.sample .env && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

Contract addresses for the frontend are read from `NEXT_PUBLIC_*` env vars (see `frontend/src/lib/contracts.ts`) — set these to the values printed by `DeployAndSettle.s.sol` after deployment.

## Disclosures

- **AED-PT is a simulated token.** No public AE Coin developer sandbox exists to integrate against at time of submission.
- **ConversionVault's exchange rate is owner-set, not oracle-sourced.** No Chainlink AED/USD price feed was found to exist on Polygon at time of research.
- **Merchant registration is admin-attested, not KYC/licensed.** This system does not verify merchant licensing status.
- **This is a routing/orchestration layer, not a licensed payment service, and makes no regulatory approval claim.** A production deployment would require integration with a licensed payment service provider and legal review of licensing scope under UAE law.
- **Testnet only.** Runs on Polygon Amoy — no real funds at risk.

## Roadmap

**Phase 1 — this hackathon (built):** compliance-aware routing, atomic conversion, CRE-triggered settlement, merchant registry, interactive demo, merchant dashboard.

**Phase 2 — production foundations (not built, direction only):** real AE Coin integration pending CBUAE sandbox access; neobank/POS-platform API partnerships; privacy-preserving settlement for SME/enterprise flows (technology — ZK proofs or an alternative — not yet selected, see disclosure above); legal review of licensing scope under UAE Federal Decree-Law No. 6 of 2025.

**Phase 3 — extended (direction only):** multi-chain support; white-label SDK distribution for POS platforms and neobanks.
