"use client";

import { useEffect, useMemo, useState } from "react";
import {
  usePrivy,
  useSendTransaction,
  type WalletWithMetadata,
} from "@privy-io/react-auth";
import { usePublicClient, useReadContract, useBlockNumber } from "wagmi";
import { encodeFunctionData, parseAbiItem, type Hash } from "viem";
import {
  CONTRACTS,
  erc20Abi,
  MIN_ALLOWANCE_USDC,
  SPONSORED_APPROVE_CAP_USDC,
} from "@/lib/contracts";
import {
  getCheckoutDetails,
  notifyBackendCheckoutComplete,
  type CheckoutDetails,
} from "@/lib/checkout";

const settledEvent = parseAbiItem(
  "event Settled(address indexed merchant, address rail, uint256 amount, uint8 purpose, string reason)",
);

type PaymentStatus =
  | "loading"
  | "login"
  | "setup"
  | "ready"
  | "confirming"
  | "submitted"
  | "success"
  | "error";

function formatAed(amount: number): string {
  return `${amount.toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} AED`;
}

function blockExplorerLink(txHash: Hash): string {
  return `https://amoy.polygonscan.com/tx/${txHash}`;
}

interface PayPageProps {
  checkoutId: string;
}

export default function PayPage({ checkoutId }: PayPageProps) {
  const { login, logout, authenticated, ready, user } = usePrivy();
  const { sendTransaction } = useSendTransaction();
  const publicClient = usePublicClient();
  const { data: latestBlock } = useBlockNumber({ watch: true });

  const [checkout, setCheckout] = useState<CheckoutDetails | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [successTx, setSuccessTx] = useState<Hash | null>(null);
  const [actionError, setActionError] = useState<string>("");
  const [submittedMessage, setSubmittedMessage] = useState<string>("");
  const [startBlock, setStartBlock] = useState<bigint | null>(null);

  // Load checkout details on mount.
  useEffect(() => {
    let cancelled = false;
    getCheckoutDetails(checkoutId)
      .then((details) => {
        if (!cancelled) setCheckout(details);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [checkoutId]);

  const customerAddress = useMemo<`0x${string}` | undefined>(() => {
    const embedded = user?.linkedAccounts?.find(
      (a): a is WalletWithMetadata =>
        a.type === "wallet" &&
        (a.walletClientType === "privy" || a.walletClientType === "embedded"),
    );
    return embedded?.address as `0x${string}` | undefined;
  }, [user]);

  const {
    data: allowance,
    isLoading: allowanceLoading,
    refetch: refetchAllowance,
  } = useReadContract({
    address: CONTRACTS.usdc,
    abi: erc20Abi,
    functionName: "allowance",
    args:
      customerAddress &&
      CONTRACTS.settlementRouter !==
        "0x0000000000000000000000000000000000000000"
        ? [customerAddress, CONTRACTS.settlementRouter]
        : undefined,
    query: {
      enabled: Boolean(
        customerAddress &&
        CONTRACTS.settlementRouter !==
          "0x0000000000000000000000000000000000000000",
      ),
    },
  });

  let status: PaymentStatus = "loading";
  let statusMessage = "";

  if (loadError) {
    status = "error";
    statusMessage = "Could not load payment details.";
  } else if (!ready || !checkout) {
    status = "loading";
  } else if (!authenticated) {
    status = "login";
  } else if (actionError) {
    status = "error";
    statusMessage = actionError;
  } else if (successTx) {
    status = "success";
  } else if (submitted) {
    status = "submitted";
    statusMessage = submittedMessage || "Waiting for settlement confirmation…";
  } else if (confirming) {
    status = "confirming";
    statusMessage = "Confirming your payment…";
  } else if (isApproving) {
    status = "setup";
    statusMessage = "Setting up your account…";
  } else if (!customerAddress || allowanceLoading || allowance === undefined) {
    status = "setup";
    statusMessage = "Connecting to your account…";
  } else if (allowance < MIN_ALLOWANCE_USDC) {
    status = "setup";
    statusMessage = "Setting up your account…";
  } else {
    status = "ready";
  }

  const runApprove = async () => {
    if (!customerAddress || !authenticated) return;
    setIsApproving(true);
    setActionError("");
    try {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [CONTRACTS.settlementRouter, SPONSORED_APPROVE_CAP_USDC],
      });
      await sendTransaction(
        {
          to: CONTRACTS.usdc,
          data,
          value: 0n,
        },
        {
          sponsor: true,
        },
      );
      await refetchAllowance();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Account setup failed. Please try again.",
      );
    } finally {
      setIsApproving(false);
    }
  };

  const runConfirm = async () => {
    if (!checkout || !customerAddress) return;
    setConfirming(true);
    setActionError("");
    try {
      await notifyBackendCheckoutComplete(checkout.checkoutId);
      setSubmitted(true);
      setSubmittedMessage(
        "Payment submitted. Waiting for settlement confirmation…",
      );
      if (latestBlock) {
        setStartBlock(latestBlock);
      }
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Payment confirmation failed.",
      );
    } finally {
      setConfirming(false);
    }
  };

  // Poll for Settled event once we've submitted.
  useEffect(() => {
    if (!submitted || !publicClient || !checkout || !startBlock) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const logs = await publicClient.getLogs({
          address: CONTRACTS.settlementRouter,
          event: settledEvent,
          args: { merchant: checkout.merchantAddress },
          fromBlock: startBlock,
          toBlock: "latest",
        });
        if (!cancelled && logs.length > 0) {
          const last = logs[logs.length - 1];
          setSuccessTx(last.transactionHash);
        }
      } catch {
        // Ignore transient RPC errors; the next poll will retry.
      }
    };
    void poll();
    const id = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [submitted, publicClient, checkout, startBlock]);

  // Safety timeout: after 2 minutes in submitted state, show a generic message.
  useEffect(() => {
    if (!submitted || successTx) return;
    const id = setTimeout(() => {
      setSubmittedMessage(
        "Payment is being settled. You can close this screen; we will notify you once it is complete.",
      );
    }, 120_000);
    return () => clearTimeout(id);
  }, [submitted, successTx]);

  if (!checkout) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-700" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl">
        {/* Header */}
        <div className="bg-teal-700 p-8 text-center text-white">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
            <svg
              className="h-8 w-8 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium opacity-90">You are paying</p>
          <h1 className="mt-1 text-2xl font-bold">{checkout.merchantLabel}</h1>
          <p className="mt-3 text-4xl font-semibold tracking-tight">
            {formatAed(checkout.amountAed)}
          </p>
        </div>

        {/* Body */}
        <div className="space-y-6 p-8">
          {status === "login" && (
            <>
              <p className="text-center text-slate-600">
                Sign in securely to confirm your payment. No app install needed.
              </p>
              <button
                onClick={login}
                className="w-full rounded-xl bg-teal-700 py-4 text-lg font-semibold text-white shadow-sm transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
              >
                Continue
              </button>
            </>
          )}

          {(status === "setup" || status === "confirming") && (
            <div className="flex flex-col items-center space-y-4 py-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-700" />
              <p className="text-center text-slate-600">
                {statusMessage || "One moment…"}
              </p>
              {status === "setup" &&
                allowance !== undefined &&
                allowance < MIN_ALLOWANCE_USDC && (
                  <button
                    onClick={runApprove}
                    disabled={isApproving}
                    className="mt-2 w-full rounded-xl bg-slate-900 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {isApproving ? "Setting up…" : "Set up account"}
                  </button>
                )}
            </div>
          )}

          {status === "ready" && (
            <>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-slate-500">Merchant</span>
                  <span className="font-medium text-slate-900">
                    {checkout.merchantLabel}
                  </span>
                </div>
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-medium text-slate-900">
                    {formatAed(checkout.amountAed)}
                  </span>
                </div>
              </div>
              <button
                onClick={runConfirm}
                disabled={confirming}
                className="w-full rounded-xl bg-teal-700 py-4 text-lg font-semibold text-white shadow-sm transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:opacity-60"
              >
                {confirming ? "Confirming…" : "Confirm payment"}
              </button>
            </>
          )}

          {(status === "submitted" || status === "success") && (
            <div className="flex flex-col items-center space-y-4 py-4">
              {status === "success" ? (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <svg
                    className="h-8 w-8 text-green-700"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              ) : (
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-700" />
              )}
              <p className="text-center text-lg font-medium text-slate-900">
                {status === "success" ? "Payment sent" : "Payment submitted"}
              </p>
              <p className="text-center text-slate-600">
                {status === "success"
                  ? "Your payment has been settled."
                  : submittedMessage || "Waiting for settlement confirmation…"}
              </p>
              {successTx && (
                <a
                  href={blockExplorerLink(successTx)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-teal-700 hover:underline"
                >
                  View on chain
                </a>
              )}
            </div>
          )}

          {status === "error" && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-center">
              <p className="font-medium text-red-800">Something went wrong</p>
              <p className="mt-1 text-sm text-red-700">{statusMessage}</p>
              <button
                onClick={() => setActionError("")}
                className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
              >
                Try again
              </button>
            </div>
          )}

          {authenticated && (
            <button
              onClick={logout}
              className="w-full text-center text-sm text-slate-400 hover:text-slate-600"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
