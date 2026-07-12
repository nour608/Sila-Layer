import {
  bytesToHex,
  consensusIdenticalAggregation,
  CronCapability,
  EVMClient,
  getNetwork,
  handler,
  hexToBase64,
  HTTPClient,
  Runner,
  TxStatus,
  type CronPayload,
  type HTTPSendRequester,
  type Runtime,
} from "@chainlink/cre-sdk";
import { encodeAbiParameters, parseAbiParameters } from "viem";
import { z } from "zod";

/**
 * Settlement workflow.
 *
 * Cron-polls a "pending checkouts" endpoint, then for each completed checkout submits a
 * DON-signed report to the SettlementReceiver contract, which forwards it to
 * SettlementRouter.settle(...). The router alone decides the rail (USDC vs AED-PT) from the
 * MerchantRegistry — this workflow makes no compliance decision.
 *
 */

const configSchema = z.object({
  schedule: z.string(),
  // Backend exposing pending checkouts + a result sink. In Slice 4 this is the Square-fed API.
  backendBaseUrl: z.string().min(1),
  backendInternalToken: z.string().optional(),
  pendingCheckoutsPath: z.string(),
  onchainResultPath: z.string(),
  chainSelectorName: z.string(),
  isTestnet: z.boolean(),
  // The SettlementReceiver (IReceiver) address — NOT the router. CRE writes reports to onReport().
  settlementReceiverAddress: z.string(),
  gasLimit: z.string(),
  maxBatch: z.coerce.number().int().positive(),
});

type Config = z.infer<typeof configSchema>;

// report payload = abi.encode(address merchant, address payer, uint256 amount, uint8 purpose)
const reportParams = parseAbiParameters(
  "address merchant, address payer, uint256 amount, uint8 purpose",
);

const PURPOSE = {
  RetailGoods: 0,
  VirtualAssetRelated: 1,
  CrossBorderB2B: 2,
} as const;

interface PendingCheckout {
  checkoutId: string;
  merchant: `0x${string}`;
  payer: `0x${string}`;
  amount: string; // base units of the selected rail token, as decided by the router
  purpose: keyof typeof PURPOSE;
}

interface PendingResponse {
  checkouts: PendingCheckout[];
}

const getSecretValue = (runtime: Runtime<Config>, id: string): string => {
  const attempts: Array<() => string> = [
    () => runtime.getSecret({ id, namespace: "main" }).result().value,
    () => runtime.getSecret({ id }).result().value,
    () => runtime.getSecret({ id, namespace: "default" }).result().value,
  ];
  for (const attempt of attempts) {
    try {
      return attempt();
    } catch {
      continue;
    }
  }
  throw new Error(`Missing secret: ${id}`);
};

const sendJson = <T>(
  runtime: Runtime<Config>,
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: Record<string, unknown>;
  },
): T => {
  const httpClient = new HTTPClient();
  const responseText = httpClient
    .sendRequest(
      runtime,
      (sendRequester: HTTPSendRequester, req: typeof request) => {
        const bodyText = req.body ? JSON.stringify(req.body) : undefined;
        const response = sendRequester
          .sendRequest({
            url: req.url,
            method: req.method,
            headers: req.headers,
            body: Buffer.from(bodyText ?? "", "utf8").toString("base64"),
          })
          .result();
        const text = new TextDecoder().decode(response.body);
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw new Error(
            `HTTP ${req.method} ${req.url} failed with ${response.statusCode}: ${text}`,
          );
        }
        return text;
      },
      consensusIdenticalAggregation<string>(),
    )(request)
    .result();
  return JSON.parse(responseText || "{}") as T;
};

const onCronTrigger = (
  runtime: Runtime<Config>,
  _payload: CronPayload,
): string => {
  const backendToken =
    runtime.config.backendInternalToken?.trim() ||
    getSecretValue(runtime, "BACKEND_INTERNAL_TOKEN");

  const pending = sendJson<PendingResponse>(runtime, {
    url: `${runtime.config.backendBaseUrl}${runtime.config.pendingCheckoutsPath}?limit=${runtime.config.maxBatch}`,
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${backendToken}`,
    },
  });

  if (!pending.checkouts || pending.checkouts.length === 0) {
    runtime.log("No pending checkouts to settle");
    return JSON.stringify({ processed: 0 });
  }

  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: runtime.config.chainSelectorName,
    isTestnet: runtime.config.isTestnet,
  });
  if (!network) {
    throw new Error(`Network not found: ${runtime.config.chainSelectorName}`);
  }

  const evmClient = new EVMClient(network.chainSelector.selector);
  let processed = 0;

  for (const checkout of pending.checkouts) {
    try {
      const encodedPayload = encodeAbiParameters(reportParams, [
        checkout.merchant,
        checkout.payer,
        BigInt(checkout.amount),
        PURPOSE[checkout.purpose],
      ]);

      const report = runtime
        .report({
          encodedPayload: hexToBase64(encodedPayload),
          encoderName: "evm",
          signingAlgo: "ecdsa",
          hashingAlgo: "keccak256",
        })
        .result();

      const writeResponse = evmClient
        .writeReport(runtime, {
          receiver: runtime.config.settlementReceiverAddress,
          report,
          gasConfig: { gasLimit: runtime.config.gasLimit },
        })
        .result();

      if (writeResponse.txStatus !== TxStatus.SUCCESS) {
        sendJson(runtime, {
          url: `${runtime.config.backendBaseUrl}${runtime.config.onchainResultPath}`,
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${backendToken}`,
          },
          body: {
            checkoutId: checkout.checkoutId,
            outcome: "RETRYABLE",
            errorCode: "EVM_WRITE_FAILED",
            errorMessage:
              writeResponse.errorMessage || String(writeResponse.txStatus),
          },
        });
        continue;
      }

      const txHash = bytesToHex(writeResponse.txHash || new Uint8Array(32));
      sendJson(runtime, {
        url: `${runtime.config.backendBaseUrl}${runtime.config.onchainResultPath}`,
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${backendToken}`,
        },
        body: { checkoutId: checkout.checkoutId, txHash, outcome: "SUCCESS" },
      });

      processed += 1;
      runtime.log(
        `Settlement success for checkout ${checkout.checkoutId}: ${txHash}`,
      );
    } catch (error) {
      sendJson(runtime, {
        url: `${runtime.config.backendBaseUrl}${runtime.config.onchainResultPath}`,
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${backendToken}`,
        },
        body: {
          checkoutId: checkout.checkoutId,
          outcome: "RETRYABLE",
          errorCode: "WORKFLOW_EXCEPTION",
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  return JSON.stringify({ processed, requested: pending.checkouts.length });
};

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run((config: Config) => {
    const cron = new CronCapability();
    return [
      handler(cron.trigger({ schedule: config.schedule }), onCronTrigger),
    ];
  });
}
