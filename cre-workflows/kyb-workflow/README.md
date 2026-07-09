# KYB Workflow (CRE) — Slice 4

Cron-driven CRE workflow that turns a Sumsub KYB review into an on-chain merchant
registration in `MerchantRegistry`.

## Flow

1. Poll backend `GET /internal/kyb/pending?limit=maxBatch`.
2. For each `{ wallet, applicantId }`:
   - Call Sumsub `GET /resources/applicants/{applicantId}/one` with HMAC-SHA256 signing.
   - Map a Sumsub tag / questionnaire value to `Mainland` or `DIFC` (default `Mainland`).
   - If `reviewResult.reviewAnswer === 'GREEN'`, ABI-encode `(address merchant, uint8 zone, string label)`.
   - Create a DON-signed report and write it on-chain to `MerchantRegistryReceiver.onReport(...)`.
   - Post `SUCCESS` / `RETRYABLE` to `POST /internal/kyb/onchain-result`.
3. If the review is complete but not `GREEN`, post `SUCCESS` so the entry is not re-polled.
4. If no review result exists yet, leave the entry pending for the next cron tick.

## On-chain path

CRE only delivers reports to `IReceiver.onReport`. `MerchantRegistryReceiver.sol` (deployed and
set as `MerchantRegistry.registrar`) decodes the report and calls `registerMerchant(...)`. The
registry itself remains the source of truth for zone/rail rules.

## Zone derivation (MVP convention)

This workflow does **not** make a legal licensing determination. The zone is derived from a
documented Sumsub convention: the first matching `DIFC` / `Mainland` value found in
the applicant `reviewResult.tags` or top-level `tags` (case-insensitive). If none is found,
`Mainland` is used.

## Config (`config.staging.json`)

- `schedule`, `backendBaseUrl`, `pendingKybPath`, `onchainResultPath`
- `sumsubBaseUrl` — `https://api.sumsub.com`
- `chainSelectorName` = `polygon-testnet-amoy`, `isTestnet` = `true`
- `merchantRegistryReceiverAddress` — deployed `MerchantRegistryReceiver` (fill after deploy)
- `gasLimit`, `maxBatch`

## Secrets

- `BACKEND_INTERNAL_TOKEN` (workflow `secrets.yaml`)
- `SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`
- `CRE_ETH_PRIVATE_KEY`, `CRE_TARGET` in `cre-workflows/.env` (64 hex chars, no `0x`)

## Run

Typecheck (from this dir):

```bash
bun x tsc --noEmit
```

Simulate (from `cre-workflows/`):

```bash
cre workflow simulate ./kyb-workflow --target staging-settings --non-interactive --trigger-index 0
```

Broadcast simulation:

```bash
cre workflow simulate ./kyb-workflow --target staging-settings --non-interactive --trigger-index 0 --broadcast -g -v
```

## Gotchas

- `PerWorkflow.HTTPAction.CallLimit ... limit is 5`: each item makes 1 backend GET + 1 Sumsub
  GET + 1 backend POST, so keep `maxBatch` at `2` or lower in simulation.
- Sumsub HMAC signing uses `ts + METHOD + path + body`; body is empty for GET.
- Amoy MockKeystoneForwarder (simulation): `0x3675a5eb2286a3f87e8278fc66edf458a2e3bb74`.
