# Settlement Workflow (CRE) — Slice 3

Cron-driven CRE workflow that:

1. Pulls pending checkouts from `GET /internal/checkouts/pending?limit=maxBatch`
2. Encodes report payload `(address merchant, address payer, uint256 amount, uint8 purpose)`
3. Writes the DON-signed report onchain to **`SettlementReceiver`** (an `IReceiver`), which
   forwards to `SettlementRouter.settle(...)`. The router alone selects the rail (USDC vs
   AED-PT) from `MerchantRegistry` — this workflow makes no compliance decision.
4. Posts `SUCCESS` / `RETRYABLE` to `POST /internal/checkouts/onchain-result`

Adapted from `The-old-version-of-Sila Layer/oracle-CRE-Integrations/kyc-settlement-workflow`,
repointed from Ethereum Sepolia to **Polygon Amoy** (`polygon-testnet-amoy`).

## Why a receiver, not settle() directly

CRE never calls arbitrary functions. It delivers DON-signed reports to `onReport(metadata,
report)` on an `IReceiver`, via the KeystoneForwarder (see docs.chain.link "Onchain Write").
`SettlementReceiver.sol` (in `smart-contracts/contracts/`) is that mailbox; the audited
`SettlementRouter` stays frozen.

## Prerequisites for settlement to succeed

`SettlementRouter.settle` pulls the rail token from `payer` via `transferFrom`. There is no
human to approve at settle-time, so **each payer must hold a standing ERC-20 allowance to the
router** for the rail token. For the demo, payer accounts are pre-funded and pre-approved.

## Config (`config.staging.json`)

- `schedule`, `backendBaseUrl`, `pendingCheckoutsPath`, `onchainResultPath`
- `chainSelectorName` = `polygon-testnet-amoy`, `isTestnet` = `true`
- `settlementReceiverAddress` — deployed `SettlementReceiver` (fill after deploy)
- `gasLimit`, `maxBatch`

## Secrets

- `BACKEND_INTERNAL_TOKEN` (workflow `secrets.yaml`)
- `CRE_ETH_PRIVATE_KEY`, `CRE_TARGET` in `cre-workflows/.env` (64 hex chars, no `0x`)

## Run

Typecheck (from this dir):

```bash
bun x tsc --noEmit
```

Simulate (from `cre-workflows/`):

```bash
cre workflow simulate ./settlement-workflow --target staging-settings --non-interactive --trigger-index 0
```

Broadcast simulation (writes to the chain via MockKeystoneForwarder):

```bash
cre workflow simulate ./settlement-workflow --target staging-settings --non-interactive --trigger-index 0 --broadcast -g -v
```

## Gotchas (from the old integration)

- `PerWorkflow.HTTPAction.CallLimit ... limit is 5`: this workflow makes 1 GET + 1 POST per
  checkout, so keep `maxBatch` low (currently `3`) in simulation.
- `Invalid internal API token`: `BACKEND_INTERNAL_TOKEN` must match the backend.
- `failed to parse private key`: `CRE_ETH_PRIVATE_KEY` must be 64 hex chars without `0x`.
- Amoy MockKeystoneForwarder (simulation): `0x3675a5eb2286a3f87e8278fc66edf458a2e3bb74`.
