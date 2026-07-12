"use client";

import { useState } from "react";
import Link from "next/link";
import { usePrivy, useSendTransaction } from "@privy-io/react-auth";
import { encodeFunctionData, type Hash } from "viem";
import {
  CONTRACTS,
  conversionVaultAbi,
  erc20Abi,
  merchantRegistryAbi,
} from "@/lib/contracts";
import type { WalletWithMetadata } from "@privy-io/react-auth";

function hashLink(txHash: Hash): string {
  return `https://amoy.polygonscan.com/tx/${txHash}`;
}

export default function AdminPanel() {
  const { login, logout, authenticated, ready, user } = usePrivy();
  const { sendTransaction } = useSendTransaction();

  const [status, setStatus] = useState<string>("");
  const [txHash, setTxHash] = useState<Hash | null>(null);

  const [merchantAddress, setMerchantAddress] = useState("");
  const [merchantZone, setMerchantZone] = useState<"1" | "2">("1");
  const [merchantLabel, setMerchantLabel] = useState("");

  const customerAddress = user?.linkedAccounts.find(
    (a): a is WalletWithMetadata =>
      a.type === "wallet" &&
      (a.walletClientType === "privy" || a.walletClientType === "embedded"),
  )?.address as `0x${string}` | undefined;

  const send = async (to: `0x${string}`, data: `0x${string}`) => {
    const res = await sendTransaction({ to, data, value: 0n });
    if (res && typeof res === "object" && "hash" in res) {
      setTxHash(res.hash as Hash);
    } else if (res && typeof res === "string") {
      setTxHash(res as Hash);
    }
  };

  const seedUsdc = async () => {
    setStatus("Sending USDC seed transaction…");
    const data = encodeFunctionData({
      abi: conversionVaultAbi,
      functionName: "seedLiquidity",
      args: [CONTRACTS.usdc, 10_000n * 10n ** 6n],
    });
    await send(CONTRACTS.conversionVault, data);
    setStatus("USDC liquidity seeded.");
  };

  const seedAedpt = async () => {
    setStatus("Sending sAEDPT seed transaction…");
    const data = encodeFunctionData({
      abi: conversionVaultAbi,
      functionName: "seedLiquidity",
      args: [CONTRACTS.aedpt, 100_000n * 10n ** 2n],
    });
    await send(CONTRACTS.conversionVault, data);
    setStatus("sAEDPT liquidity seeded.");
  };

  const seedBoth = async () => {
    await seedUsdc();
    await seedAedpt();
  };

  const approveVault = async (token: `0x${string}`, decimals: number) => {
    setStatus(
      `Approving vault to spend ${token === CONTRACTS.usdc ? "USDC" : "sAEDPT"}…`,
    );
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [CONTRACTS.conversionVault, 1_000_000n * 10n ** BigInt(decimals)],
    });
    await send(token, data);
    setStatus("Vault approved.");
  };

  const registerMerchant = async () => {
    if (!merchantAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setStatus("Invalid merchant address.");
      return;
    }
    setStatus("Registering merchant…");
    const data = encodeFunctionData({
      abi: merchantRegistryAbi,
      functionName: "registerMerchant",
      args: [
        merchantAddress as `0x${string}`,
        Number(merchantZone),
        merchantLabel || "Demo Merchant",
      ],
    });
    await send(CONTRACTS.merchantRegistry, data);
    setStatus("Merchant registered.");
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-2xl">
          <p className="text-slate-600">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Demo admin</h1>
          <div className="flex items-center gap-3">
            {authenticated ? (
              <button
                onClick={logout}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Sign out
              </button>
            ) : (
              <button
                onClick={login}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
              >
                Connect wallet
              </button>
            )}
            <Link
              href="/"
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Back
            </Link>
          </div>
        </div>

        {customerAddress && (
          <p className="text-sm text-slate-500">Connected: {customerAddress}</p>
        )}

        {/* Liquidity */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            ConversionVault liquidity
          </h2>
          <p className="mb-4 text-sm text-slate-600">
            Vault must have both tokens before demo runs. Owner wallet must have
            approved the vault first (see below).
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={seedUsdc}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              Seed 10,000 USDC
            </button>
            <button
              onClick={seedAedpt}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              Seed 100,000 sAEDPT
            </button>
            <button
              onClick={seedBoth}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Seed both
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
            <button
              onClick={() => approveVault(CONTRACTS.usdc, 6)}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Approve USDC
            </button>
            <button
              onClick={() => approveVault(CONTRACTS.aedpt, 2)}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Approve sAEDPT
            </button>
          </div>
        </section>

        {/* Merchant registration */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Register test merchant
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Merchant address
              </label>
              <input
                type="text"
                value={merchantAddress}
                onChange={(e) => setMerchantAddress(e.target.value)}
                placeholder="0x…"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Zone
              </label>
              <select
                value={merchantZone}
                onChange={(e) => setMerchantZone(e.target.value as "1" | "2")}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                <option value="1">Mainland</option>
                <option value="2">DIFC</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Label
              </label>
              <input
                type="text"
                value={merchantLabel}
                onChange={(e) => setMerchantLabel(e.target.value)}
                placeholder="Demo Cafe"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>
            <button
              onClick={registerMerchant}
              className="w-full rounded-lg bg-teal-700 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Register merchant
            </button>
          </div>
        </section>

        {(status || txHash) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {status && <p className="text-sm text-slate-700">{status}</p>}
            {txHash && (
              <a
                href={hashLink(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-sm font-medium text-teal-700 hover:underline"
              >
                View last tx
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
