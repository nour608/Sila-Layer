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
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import {
  bytesToHex as nobleBytesToHex,
  utf8ToBytes,
} from "@noble/hashes/utils";
import { encodeAbiParameters, parseAbiParameters } from "viem";
import { z } from "zod";

/**
 * KYB workflow.
 *
 * Cron-polls a "pending KYB" endpoint, then for each applicant:
 *  1. Calls Sumsub (HMAC-signed) for the review result.
 *  2. Derives the regulatory zone from a Sumsub tag/questionnaire convention.
 *  3. Submits a DON-signed report to MerchantRegistryReceiver.onReport(...).
 *  4. Posts SUCCESS / RETRYABLE back so the entry is not re-submitted.
 *
 * The registry remains the source of truth for the zone; this workflow only writes an
 * already-verified zone from Sumsub.
 *
 * Zone derivation MVP convention:
 *   - If reviewResult.reviewAnswer !== 'GREEN', the applicant is skipped.
 *     If the review is complete and not GREEN we post SUCCESS to stop re-polling; if the
 *     review is not yet present we leave it pending for the next cron tick.
 *   - Otherwise the first tag/value equal to 'DIFC' or 'Mainland' (case-insensitive) wins.
 *     Default is Mainland.
 */

const configSchema = z.object({
  schedule: z.string(),
  backendBaseUrl: z.string().min(1),
  backendInternalToken: z.string().optional(),
  pendingKybPath: z.string(),
  onchainResultPath: z.string(),
  sumsubBaseUrl: z.string().min(1),
  chainSelectorName: z.string(),
  isTestnet: z.boolean(),
  merchantRegistryReceiverAddress: z.string(),
  gasLimit: z.string(),
  maxBatch: z.coerce.number().int().positive(),
});

type Config = z.infer<typeof configSchema>;

// report payload = abi.encode(address merchant, uint8 zone, string label)
const reportParams = parseAbiParameters(
  "address merchant, uint8 zone, string label",
);

const ZONE = {
  Unregistered: 0,
  Mainland: 1,
  DIFC: 2,
} as const;
type ZoneName = keyof typeof ZONE;

interface PendingKyb {
  wallet: `0x${string}`;
  applicantId: string;
}

interface PendingResponse {
  entries: PendingKyb[];
}

interface SumsubReviewResult {
  reviewAnswer?: string;
  tags?: unknown[];
}

interface SumsubApplicant {
  id: string;
  externalUserId?: string;
  reviewResult?: SumsubReviewResult;
  tags?: unknown[];
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

/**
 * Sumsub HMAC signature as documented at https://developers.sumsub.com/
 * sig = HMAC(secretKey, ts + method.toUpperCase() + path + body)
 */
const sumsubHeaders = (
  secretKey: string,
  appToken: string,
  method: string,
  path: string,
  body = "",
): Record<string, string> => {
  const ts = String(Math.floor(Date.now() / 1000));
  const payload = ts + method.toUpperCase() + path + body;
  const sig = nobleBytesToHex(
    hmac(sha256, utf8ToBytes(secretKey), utf8ToBytes(payload)),
  );
  return {
    "X-App-Token": appToken,
    "X-App-Access-Sig": sig,
    "X-App-Access-Ts": ts,
  };
};

const findZoneTag = (root: unknown): ZoneName | undefined => {
  if (typeof root === "string") {
    const upper = root.toUpperCase();
    if (upper === "DIFC") return "DIFC";
    if (upper === "MAINLAND") return "Mainland";
    return undefined;
  }
  if (Array.isArray(root)) {
    for (const item of root) {
      const found = findZoneTag(item);
      if (found) return found;
    }
    return undefined;
  }
  if (root && typeof root === "object") {
    for (const value of Object.values(root)) {
      const found = findZoneTag(value);
      if (found) return found;
    }
  }
  return undefined;
};

/** Result from Sumsub review → zone mapping. */
interface DerivedZone {
  zoneRaw: number;
  label: string;
}

/**
 * Derive the merchant zone from a Sumsub applicant object.
 * @returns `DerivedZone` if approved, `null` if review complete but not approved,
 *          `undefined` if review not yet available.
 */
const deriveZone = (
  applicant: SumsubApplicant,
): DerivedZone | null | undefined => {
  const answer = applicant.reviewResult?.reviewAnswer;
  if (answer !== "GREEN") {
    if (answer) {
      // Review complete but not approved.
      return null;
    }
    // Review not yet present; caller will leave pending and retry next tick.
    return undefined;
  }

  const zoneName =
    findZoneTag(applicant.reviewResult?.tags) ??
    findZoneTag(applicant.tags) ??
    "Mainland";
  return { zoneRaw: ZONE[zoneName], label: `Sumsub ${zoneName}` };
};

const onCronTrigger = (
  runtime: Runtime<Config>,
  _payload: CronPayload,
): string => {
  const backendToken =
    runtime.config.backendInternalToken?.trim() ||
    getSecretValue(runtime, "BACKEND_INTERNAL_TOKEN");
  const sumsubAppToken = getSecretValue(runtime, "SUMSUB_APP_TOKEN");
  const sumsubSecretKey = getSecretValue(runtime, "SUMSUB_SECRET_KEY");

  const pending = sendJson<PendingResponse>(runtime, {
    url: `${runtime.config.backendBaseUrl}${runtime.config.pendingKybPath}?limit=${runtime.config.maxBatch}`,
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${backendToken}`,
    },
  });

  if (!pending.entries || pending.entries.length === 0) {
    runtime.log("No pending KYB entries to register");
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

  for (const entry of pending.entries) {
    try {
      const path = `/resources/applicants/${entry.applicantId}/one`;
      const applicant = sendJson<SumsubApplicant>(runtime, {
        url: `${runtime.config.sumsubBaseUrl}${path}`,
        method: "GET",
        headers: {
          Accept: "application/json",
          ...sumsubHeaders(sumsubSecretKey, sumsubAppToken, "GET", path),
        },
      });

      const derived = deriveZone(applicant);
      if (derived === undefined) {
        // Review not ready yet, leave pending for next tick.
        runtime.log(
          `KYB review not ready for ${entry.applicantId}, leaving pending`,
        );
        continue;
      }
      if (derived === null) {
        // Review complete but not GREEN; mark done so we don't keep polling.
        sendJson(runtime, {
          url: `${runtime.config.backendBaseUrl}${runtime.config.onchainResultPath}`,
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${backendToken}`,
          },
          body: {
            applicantId: entry.applicantId,
            outcome: "SUCCESS",
            errorCode: "SUMSUB_NOT_APPROVED",
            errorMessage: `reviewAnswer=${applicant.reviewResult?.reviewAnswer ?? "unknown"}`,
          },
        });
        continue;
      }

      if (derived.zoneRaw === ZONE.Unregistered) {
        // Should never happen because zoneName defaults to Mainland, but guard anyway.
        sendJson(runtime, {
          url: `${runtime.config.backendBaseUrl}${runtime.config.onchainResultPath}`,
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${backendToken}`,
          },
          body: {
            applicantId: entry.applicantId,
            outcome: "SUCCESS",
            errorCode: "UNREGISTERED_ZONE",
            errorMessage: " Derived zone was Unregistered",
          },
        });
        continue;
      }

      const encodedPayload = encodeAbiParameters(reportParams, [
        entry.wallet,
        derived.zoneRaw,
        derived.label,
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
          receiver: runtime.config.merchantRegistryReceiverAddress,
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
            applicantId: entry.applicantId,
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
        body: {
          applicantId: entry.applicantId,
          txHash,
          outcome: "SUCCESS",
        },
      });

      processed += 1;
      runtime.log(
        `KYB registration success for applicant ${entry.applicantId}: ${txHash}`,
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
          applicantId: entry.applicantId,
          outcome: "RETRYABLE",
          errorCode: "WORKFLOW_EXCEPTION",
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  return JSON.stringify({ processed, requested: pending.entries.length });
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
