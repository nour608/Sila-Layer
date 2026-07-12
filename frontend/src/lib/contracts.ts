// Shared contract configuration and ABIs for the Sila Layer frontend.
// Replace placeholder addresses with deployed Amoy values when available.

import type { Abi } from "viem";

export const polygonAmoy = {
  id: 80_002,
  name: "Polygon Amoy",
  nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_AMOY_RPC_URL ??
          "https://rpc-amoy.polygon.technology",
      ],
    },
  },
  blockExplorers: {
    default: { name: "Polygonscan Amoy", url: "https://amoy.polygonscan.com" },
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════════════════════
// Placeholder addresses — MUST be replaced with deployed values via the admin page or env vars.
// ═══════════════════════════════════════════════════════════════════════════════════════════
export const CONTRACTS = {
  usdc: (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  aedpt: (process.env.NEXT_PUBLIC_AEDPT_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  settlementRouter: (process.env.NEXT_PUBLIC_SETTLEMENT_ROUTER_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  merchantRegistry: (process.env.NEXT_PUBLIC_MERCHANT_REGISTRY_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  conversionVault: (process.env.NEXT_PUBLIC_CONVERSION_VAULT_ADDRESS ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
};

// Bounded approval cap for the settlement router — a few hundred USD equivalent.
// TUNABLE: change this value to adjust the pre-authorized spend ceiling.
// Never use type(uint256).max. USDC has 6 decimals.
export const SPONSORED_APPROVE_CAP_USDC = 500n * 10n ** 6n; // 500 USDC

export const MIN_ALLOWANCE_USDC = SPONSORED_APPROVE_CAP_USDC;

// ERC-20 ABI — includes balanceOf, allowance, approve, decimals, symbol.
export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "Approval",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "spender", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const satisfies Abi;

// SettlementRouter ABI — full Settled event per ARCHITECTURE.md §2.2.
// Fields: merchant (indexed), rail, payerAsset, amountIn, amountOut, purpose, reason.
// NOTE: the older 5-field event (without payerAsset/amountIn/amountOut) is also
// accepted by the dashboard — extra fields simply won't decode for old logs.
export const settlementRouterAbi = [
  {
    type: "event",
    name: "Settled",
    inputs: [
      { name: "merchant", type: "address", indexed: true },
      { name: "rail", type: "address", indexed: false },
      { name: "payerAsset", type: "address", indexed: false },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "amountOut", type: "uint256", indexed: false },
      { name: "purpose", type: "uint8", indexed: false },
      { name: "reason", type: "string", indexed: false },
    ],
  },
] as const satisfies Abi;

// MerchantRegistry ABI subset for reading merchant labels.
export const merchantRegistryAbi = [
  {
    type: "function",
    name: "getMerchant",
    inputs: [{ name: "merchant", type: "address" }],
    outputs: [
      { name: "zone", type: "uint8" },
      { name: "active", type: "bool" },
      { name: "label", type: "string" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "registerMerchant",
    inputs: [
      { name: "merchant", type: "address" },
      { name: "zone", type: "uint8" },
      { name: "label", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const satisfies Abi;

// ConversionVault ABI subset for admin functions.
export const conversionVaultAbi = [
  {
    type: "function",
    name: "seedLiquidity",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setRate",
    inputs: [
      { name: "fromToken", type: "address" },
      { name: "toToken", type: "address" },
      { name: "rate", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const satisfies Abi;
