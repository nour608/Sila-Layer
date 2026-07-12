"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { usePublicClient } from "wagmi";
import { formatUnits, type Hash } from "viem";
import { CONTRACTS, erc20Abi, merchantRegistryAbi } from "@/lib/contracts";
import { SettlementsLedger, type SettlementRow } from "./SettlementsLedger";

const BLOCK_RANGE = 5000n;

function countToday(rows: SettlementRow[]): number {
  const cutoff = Date.now() / 1000 - 86_400;
  return rows.filter((r) => r.timestamp >= cutoff).length;
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function DashboardSidebar({
  address,
  merchantLabel,
  onLogout,
}: {
  address?: string;
  merchantLabel?: string;
  onLogout: () => void;
}) {
  const [activeNav, setActiveNav] = useState("overview");

  const navItems = [
    {
      id: "overview",
      label: "Overview",
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
          <rect x="9.5" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
          <rect x="1" y="9.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
          <rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      ),
    },
    {
      id: "settlements",
      label: "Settlements",
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: "wallet",
      label: "Wallet",
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M1 6h14" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="11.5" cy="9.5" r="1" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: "settings",
      label: "Settings",
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.42 1.42M11.53 11.53l1.42 1.42M3.05 12.95l1.42-1.42M11.53 4.47l1.42-1.42" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <aside className="dashboard-sidebar">
      {/* Logo */}
      <div style={{ padding: "20px 20px 16px" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "9px", textDecoration: "none" }}>
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="6" fill="var(--dirham-teal)" />
            <path d="M8 19.5c0-1.5 1-2.5 3-3l5-1.2c2-.5 3-1.8 3-3.3 0-1.8-1.4-3-3.5-3-2.2 0-3.7 1.2-3.7 3H9.2C9.2 9.5 11.3 8 14.6 8c3.2 0 5.4 1.8 5.4 4.5 0 2.2-1.3 3.8-3.8 4.4L11.5 18c-1.3.3-1.9.9-1.9 1.8H20V21H8v-1.5z" fill="white" />
          </svg>
          <div>
            <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: "14px", color: "#fff", letterSpacing: "-0.02em", display: "block" }}>
              Sila Layer
            </span>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "10px", color: "rgba(255,255,255,0.4)", display: "block" }}>
              {merchantLabel || "Merchant Dashboard"}
            </span>
          </div>
        </Link>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", backgroundColor: "rgba(255,255,255,0.07)", margin: "0 16px" }} />

      {/* Nav */}
      <nav style={{ padding: "12px 10px", flex: 1 }}>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", margin: "8px 10px 10px" }}>
          Navigation
        </p>
        {navItems.map((item) => {
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "none",
                background: isActive ? "rgba(15,107,92,0.3)" : "transparent",
                cursor: "pointer",
                marginBottom: "2px",
                transition: "background 0.15s",
                color: isActive ? "#fff" : "rgba(255,255,255,0.55)",
              }}
            >
              <span style={{ flexShrink: 0, display: "flex" }}>{item.icon}</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13.5px", fontWeight: isActive ? 600 : 400 }}>
                {item.label}
              </span>
              {isActive && (
                <span style={{ marginLeft: "auto", width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "var(--dirham-teal)", flexShrink: 0 }} />
              )}
            </button>
          );
        })}

        {/* Docs link */}
        <div style={{ marginTop: "16px", height: "1px", backgroundColor: "rgba(255,255,255,0.07)", margin: "16px 4px" }} />
        <Link
          href="/docs"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "9px 12px",
            borderRadius: "8px",
            textDecoration: "none",
            color: "rgba(255,255,255,0.4)",
            fontFamily: "'Inter', sans-serif",
            fontSize: "13.5px",
            fontWeight: 400,
            transition: "all 0.15s",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 2h8a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" />
            <path d="M5 5.5h6M5 8h6M5 10.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Documentation
        </Link>
      </nav>

      {/* Bottom: address + logout */}
      <div
        style={{
          padding: "16px",
          borderTop: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {address && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              backgroundColor: "rgba(255,255,255,0.04)",
              marginBottom: "10px",
            }}
          >
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", margin: "0 0 4px" }}>
              Connected wallet
            </p>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "rgba(255,255,255,0.7)", margin: 0 }}>
              {truncateAddress(address)}
            </p>
          </div>
        )}
        <button
          onClick={onLogout}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "9px 12px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent",
            cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
            fontSize: "13px",
            fontWeight: 500,
            color: "rgba(255,255,255,0.5)",
            transition: "all 0.15s",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 9.5L11.5 7m0 0L9 4.5M11.5 7H5M5 1H2.5a1 1 0 00-1 1v10a1 1 0 001 1H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}

// ─── Unregistered state ───────────────────────────────────────────────────────
function UnregisteredState({ address }: { address: string }) {
  return (
    <div
      style={{
        maxWidth: "520px",
        margin: "80px auto",
        border: "1px solid rgba(176,141,87,0.2)",
        borderLeft: "4px solid var(--brass)",
        borderRadius: "0 10px 10px 0",
        backgroundColor: "#fff",
        padding: "32px 36px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
      }}
    >
      <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: "16px", color: "var(--brass)", margin: "0 0 10px" }}>
        Wallet not registered
      </p>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", color: "var(--ash)", margin: "0 0 20px", lineHeight: "1.65" }}>
        The connected address is not in the merchant registry. Contact the Sila Layer team to
        register your merchant wallet.
      </p>
      <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "var(--ash)", margin: 0, wordBreak: "break-all", backgroundColor: "var(--limestone)", padding: "10px 12px", borderRadius: "6px", border: "1px solid var(--border)" }}>
        {address}
      </p>
      <a
        href="mailto:hello@silalayer.xyz"
        style={{ display: "inline-block", marginTop: "16px", fontFamily: "'Inter', sans-serif", fontSize: "14px", fontWeight: 500, color: "#fff", backgroundColor: "var(--dirham-teal)", padding: "10px 20px", borderRadius: "var(--radius-pill)", textDecoration: "none" }}
      >
        Contact us to register →
      </a>
    </div>
  );
}

// ─── Quick action card ────────────────────────────────────────────────────────
function QuickAction({ icon, label, description, onClick }: { icon: React.ReactNode; label: string; description: string; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "6px",
        padding: "18px 20px",
        borderRadius: "10px",
        border: "1.5px solid",
        borderColor: hovered ? "var(--dirham-teal)" : "var(--border)",
        background: hovered ? "rgba(15,107,92,0.03)" : "#fff",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.2s ease",
        width: "100%",
      }}
    >
      <span style={{ color: "var(--dirham-teal)", display: "flex" }}>{icon}</span>
      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
        {label}
      </span>
      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "var(--ash)" }}>
        {description}
      </span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const { ready, authenticated, logout } = usePrivy();
  const { wallets } = useWallets();
  const publicClient = usePublicClient();

  const [merchantAddress, setMerchantAddress] = useState<`0x${string}` | null>(null);
  const [merchantLabel, setMerchantLabel] = useState<string>("");
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);

  const [aedptBalance, setAedptBalance] = useState<string>("");
  const [usdcBalance, setUsdcBalance] = useState<string>("");
  const [balancesLoading, setBalancesLoading] = useState(true);

  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState("");

  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (ready && !authenticated) {
      router.replace("/login");
    }
  }, [ready, authenticated, router]);

  // ── Resolve merchant address ────────────────────────────────────────────────
  useEffect(() => {
    const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
    const addr = (embeddedWallet?.address ?? wallets[0]?.address) as `0x${string}` | undefined;
    if (addr) setMerchantAddress(addr);
  }, [wallets]);

  // ── Registry check ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!publicClient || !merchantAddress) return;
    publicClient
      .readContract({
        address: CONTRACTS.merchantRegistry,
        abi: merchantRegistryAbi,
        functionName: "getMerchant",
        args: [merchantAddress],
      })
      .then(([zone, active, label]) => {
        setIsRegistered(zone !== 0 && active);
        setMerchantLabel(label || "Merchant");
      })
      .catch(() => {
        setIsRegistered(true);
        setMerchantLabel("Merchant");
      });
  }, [publicClient, merchantAddress]);

  // ── Balances ────────────────────────────────────────────────────────────────
  const fetchBalances = useCallback(async () => {
    if (!publicClient || !merchantAddress) return;
    setBalancesLoading(true);
    try {
      const [aedptRaw, usdcRaw] = await Promise.all([
        publicClient.readContract({ address: CONTRACTS.aedpt, abi: erc20Abi, functionName: "balanceOf", args: [merchantAddress] }),
        publicClient.readContract({ address: CONTRACTS.usdc, abi: erc20Abi, functionName: "balanceOf", args: [merchantAddress] }),
      ]);
      setAedptBalance(formatUnits(aedptRaw as bigint, 2));
      setUsdcBalance(formatUnits(usdcRaw as bigint, 6));
    } catch {
      setAedptBalance("—");
      setUsdcBalance("—");
    } finally {
      setBalancesLoading(false);
    }
  }, [publicClient, merchantAddress]);

  useEffect(() => {
    void fetchBalances();
    const id = setInterval(fetchBalances, 30_000);
    return () => clearInterval(id);
  }, [fetchBalances]);

  // ── Settlement events ───────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    if (!publicClient || !merchantAddress) return;
    try {
      const latest = await publicClient.getBlockNumber();
      const fromBlock = latest > BLOCK_RANGE ? latest - BLOCK_RANGE : 0n;
      const logs = await publicClient.getLogs({
        address: CONTRACTS.settlementRouter,
        event: {
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
        } as const,
        args: { merchant: merchantAddress },
        fromBlock,
        toBlock: "latest",
      });

      const enriched = await Promise.all(
        logs.map(async (log) => {
          const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
          const args = log.args as {
            merchant?: `0x${string}`;
            rail?: `0x${string}`;
            payerAsset?: `0x${string}`;
            amountIn?: bigint;
            amountOut?: bigint;
            purpose?: number;
            reason?: string;
          };
          return {
            txHash: log.transactionHash as Hash,
            blockNumber: log.blockNumber,
            timestamp: Number(block.timestamp),
            merchant: (args.merchant ?? merchantAddress) as `0x${string}`,
            rail: (args.rail ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
            payerAsset: args.payerAsset,
            amountIn: args.amountIn,
            amountOut: args.amountOut ?? 0n,
            purpose: Number(args.purpose ?? 0),
            reason: args.reason ?? "",
          } satisfies SettlementRow;
        }),
      );

      enriched.sort((a, b) => b.timestamp - a.timestamp);
      setRows(enriched);
      setEventsError("");
      setLastRefreshed(new Date());
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setEventsLoading(false);
    }
  }, [publicClient, merchantAddress]);

  useEffect(() => {
    void fetchEvents();
    const id = setInterval(fetchEvents, 10_000);
    return () => clearInterval(id);
  }, [fetchEvents]);

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (!ready || (ready && authenticated && isRegistered === null)) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "var(--limestone)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "28px", height: "28px", border: "3px solid var(--border)", borderTopColor: "var(--dirham-teal)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "var(--ash)", margin: 0 }}>
            Loading dashboard…
          </p>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const now = new Date();
  const greeting =
    now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="dashboard-layout">
      <DashboardSidebar
        address={merchantAddress ?? undefined}
        merchantLabel={merchantLabel}
        onLogout={handleLogout}
      />

      <div className="dashboard-main">
        {isRegistered === false && merchantAddress ? (
          <UnregisteredState address={merchantAddress} />
        ) : (
          <>
            {/* ── Top bar ── */}
            <header
              style={{
                backgroundColor: "#fff",
                borderBottom: "1px solid var(--border)",
                padding: "0 32px",
                height: "60px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                position: "sticky",
                top: 0,
                zIndex: 10,
              }}
            >
              <div>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.015em" }}>
                  {greeting}, {merchantLabel || "Merchant"} 👋
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {lastRefreshed && (
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "var(--text-subtle)" }}>
                    Updated {lastRefreshed.toLocaleTimeString()}
                  </span>
                )}
                <button
                  onClick={() => { void fetchEvents(); void fetchBalances(); }}
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--dirham-teal)",
                    background: "rgba(15,107,92,0.07)",
                    border: "none",
                    padding: "7px 14px",
                    borderRadius: "var(--radius-pill)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M11 6.5A4.5 4.5 0 112 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    <path d="M11 3v3.5h-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Refresh
                </button>
              </div>
            </header>

            {/* ── Main content ── */}
            <main style={{ padding: "32px 32px 64px" }}>
              {/* Live indicator */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "24px" }}>
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#22c55e", display: "inline-block", boxShadow: "0 0 0 2px rgba(34,197,94,0.25)" }} />
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "var(--ash)", fontWeight: 500 }}>
                  Live · Polygon Amoy Testnet
                </span>
              </div>

              {/* ── Metric cards ── */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "16px",
                  marginBottom: "32px",
                }}
              >
                <div style={{ backgroundColor: "#fff", border: "1px solid var(--border)", borderRadius: "12px", padding: "22px 24px", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", backgroundColor: "var(--dirham-teal)", borderRadius: "12px 12px 0 0" }} />
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ash)", margin: "0 0 12px" }}>
                    AED-PT Balance
                  </p>
                  {balancesLoading ? (
                    <div style={{ height: "32px", background: "var(--limestone)", borderRadius: "6px", width: "120px" }} />
                  ) : (
                    <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "26px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
                      {aedptBalance || "—"}
                    </p>
                  )}
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "var(--ash)", margin: 0 }}>
                    Simulated AED Payment Token
                  </p>
                </div>

                <div style={{ backgroundColor: "#fff", border: "1px solid var(--border)", borderRadius: "12px", padding: "22px 24px", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", backgroundColor: "var(--usdc-navy)", borderRadius: "12px 12px 0 0" }} />
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ash)", margin: "0 0 12px" }}>
                    USDC Balance
                  </p>
                  {balancesLoading ? (
                    <div style={{ height: "32px", background: "var(--limestone)", borderRadius: "6px", width: "100px" }} />
                  ) : (
                    <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "26px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
                      {usdcBalance || "—"}
                    </p>
                  )}
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "var(--ash)", margin: 0 }}>
                    Circle testnet USDC
                  </p>
                </div>

                <div style={{ backgroundColor: "#fff", border: "1px solid var(--border)", borderRadius: "12px", padding: "22px 24px", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, var(--dirham-teal), var(--usdc-navy))", borderRadius: "12px 12px 0 0" }} />
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ash)", margin: "0 0 12px" }}>
                    Settlements Today
                  </p>
                  {eventsLoading && rows.length === 0 ? (
                    <div style={{ height: "32px", background: "var(--limestone)", borderRadius: "6px", width: "60px" }} />
                  ) : (
                    <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "26px", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
                      {countToday(rows)}
                    </p>
                  )}
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "var(--ash)", margin: 0 }}>
                    Last 24 hours
                  </p>
                </div>
              </div>

              {/* ── Quick actions ── */}
              <div style={{ marginBottom: "32px" }}>
                <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 14px", letterSpacing: "-0.01em" }}>
                  Quick actions
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                  <QuickAction
                    icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.4" /><path d="M9 6v6M6 9h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>}
                    label="Generate payment link"
                    description="Create a one-time payment request"
                  />
                  <QuickAction
                    icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9l4 4 8-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /><path d="M15 3v4h-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    label="Export CSV"
                    description="Download settlement history"
                  />
                  <QuickAction
                    icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.4" /><path d="M9 5v4l3 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>}
                    label="View audit trail"
                    description="Full compliance history with reasons"
                  />
                </div>
              </div>

              {/* ── Settlements ledger ── */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                  <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.01em" }}>
                    Settlement ledger
                  </h2>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "var(--ash)" }}>
                    {rows.length} records (last {BLOCK_RANGE.toString()} blocks)
                  </span>
                </div>
                <SettlementsLedger rows={rows} loading={eventsLoading} error={eventsError} />
              </div>

              {/* ── Disclosure ── */}
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "11px",
                  color: "var(--text-subtle)",
                  marginTop: "32px",
                  lineHeight: "1.65",
                  padding: "16px 20px",
                  background: "rgba(0,0,0,0.02)",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                }}
              >
                AED-PT is a simulated token standing in for a CBUAE-licensed AED Payment Token.
                USDC is Circle&apos;s real testnet token on Polygon Amoy. Exchange rates are owner-set
                in ConversionVault and do not reflect a live price feed.
              </p>
            </main>
          </>
        )}
      </div>
    </div>
  );
}
