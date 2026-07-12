"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { usePublicClient } from "wagmi";
import { CONTRACTS, merchantRegistryAbi } from "@/lib/contracts";
import Link from "next/link";
import { InteractiveDotsCanvas } from "@/components/landing/InteractiveDotsCanvas";

// ─── Not-registered callout ───────────────────────────────────────────────────
function NotRegisteredState({ address }: { address: string }) {
  return (
    <div
      style={{
        border: "1px solid rgba(176,141,87,0.3)",
        borderLeft: "3px solid var(--brass)",
        borderRadius: "0 8px 8px 0",
        backgroundColor: "rgba(176,141,87,0.05)",
        padding: "18px 20px",
        marginTop: "20px",
      }}
    >
      <p
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: "14px",
          fontWeight: 600,
          color: "var(--brass)",
          margin: "0 0 8px",
        }}
      >
        Wallet not in merchant registry
      </p>
      <p
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: "13px",
          color: "var(--ash)",
          margin: "0 0 14px",
          lineHeight: "1.65",
        }}
      >
        This wallet address is not registered as a Sila Layer merchant. Please contact
        the team to register your wallet.
      </p>
      <a
        href="mailto:hello@silalayer.xyz"
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: "13px",
          fontWeight: 500,
          color: "var(--dirham-teal)",
          textDecoration: "underline",
        }}
      >
        Contact us →
      </a>
      <p
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "11px",
          color: "var(--ash)",
          margin: "12px 0 0",
          wordBreak: "break-all",
          backgroundColor: "rgba(0,0,0,0.04)",
          padding: "8px 10px",
          borderRadius: "6px",
          border: "1px solid var(--border)",
        }}
      >
        {address}
      </p>
    </div>
  );
}

// ─── Login method button ──────────────────────────────────────────────────────
function LoginMethodButton({
  icon,
  label,
  onClick,
  primary = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 16px",
        borderRadius: "10px",
        border: `1.5px solid ${primary ? "var(--dirham-teal)" : hovered ? "var(--ash)" : "var(--border)"}`,
        backgroundColor: primary
          ? "var(--dirham-teal)"
          : hovered
          ? "var(--surface-alt)"
          : "#fff",
        cursor: "pointer",
        transition: "all 0.15s ease",
        fontFamily: "'Inter', sans-serif",
        fontSize: "14px",
        fontWeight: 500,
        color: primary ? "#fff" : "var(--text-primary)",
        textAlign: "left",
      }}
    >
      <span style={{ width: "20px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </span>
      {label}
    </button>
  );
}

// ─── Main login component ─────────────────────────────────────────────────────
export function LoginPage() {
  const router = useRouter();
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const publicClient = usePublicClient();
  const [registryStatus, setRegistryStatus] = useState<null | boolean>(null);

  useEffect(() => {
    if (!ready || !authenticated) return;
    const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
    const addr = (embeddedWallet?.address ?? wallets[0]?.address) as `0x${string}` | undefined;
    if (!addr || !publicClient) return;

    publicClient
      .readContract({
        address: CONTRACTS.merchantRegistry,
        abi: merchantRegistryAbi,
        functionName: "getMerchant",
        args: [addr],
      })
      .then(([zone, active]) => {
        if (zone !== 0 && active) {
          setRegistryStatus(true);
          router.replace("/dashboard");
        } else {
          setRegistryStatus(false);
        }
      })
      .catch(() => {
        setRegistryStatus(true);
        router.replace("/dashboard");
      });
  }, [ready, authenticated, wallets, publicClient, router]);

  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const connectedAddress = (embeddedWallet?.address ?? wallets[0]?.address) as `0x${string}` | undefined;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background dots */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <InteractiveDotsCanvas dotCount={120} connectDistance={100} mouseRepelRadius={70} style={{ width: "100%", height: "100%" }} />
      </div>

      {/* Card */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}
      >
        {/* Card header */}
        <div
          style={{
            padding: "28px 28px 24px",
            borderBottom: "1px solid var(--border)",
            background: "linear-gradient(135deg, rgba(15,107,92,0.04) 0%, transparent 100%)",
          }}
        >
          {/* Logo */}
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "8px", textDecoration: "none", marginBottom: "20px" }}>
            <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="6" fill="var(--dirham-teal)" />
              <path d="M8 19.5c0-1.5 1-2.5 3-3l5-1.2c2-.5 3-1.8 3-3.3 0-1.8-1.4-3-3.5-3-2.2 0-3.7 1.2-3.7 3H9.2C9.2 9.5 11.3 8 14.6 8c3.2 0 5.4 1.8 5.4 4.5 0 2.2-1.3 3.8-3.8 4.4L11.5 18c-1.3.3-1.9.9-1.9 1.8H20V21H8v-1.5z" fill="white" />
            </svg>
            <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: "15px", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Sila Layer
            </span>
          </Link>

          <h1
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "20px",
              fontWeight: 800,
              color: "var(--text-primary)",
              margin: "0 0 6px",
              letterSpacing: "-0.025em",
            }}
          >
            Merchant sign-in
          </h1>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "13.5px",
              color: "var(--ash)",
              margin: 0,
              lineHeight: "1.5",
            }}
          >
            Connect your wallet or sign in with a social account.
          </p>
        </div>

        {/* Card body */}
        <div style={{ padding: "24px 28px 28px" }}>
          {!authenticated ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* Primary: all-in-one Privy modal */}
              <LoginMethodButton
                primary
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M21 7.5V6a3 3 0 00-3-3H6a3 3 0 00-3 3v1.5M21 7.5H3M21 7.5l-9 6-9-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="3" y="7.5" width="18" height="13" rx="1" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                }
                label="Continue with email or social"
                onClick={login}
              />

              <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "4px 0" }}>
                <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border)" }} />
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "var(--text-subtle)" }}>or connect wallet</span>
                <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border)" }} />
              </div>

              {/* Wallet options (these open the same Privy modal filtered to wallets) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <LoginMethodButton
                  icon={
                    <svg width="18" height="18" viewBox="0 0 35 33" fill="none">
                      <path d="M32.955 0L19.452 9.879l2.484-5.845L32.955 0z" fill="#E17726" />
                      <path d="M2.048 0L15.433 9.97l-2.367-5.936L2.048 0zM28.15 23.82l-3.527 5.397 7.548 2.078 2.168-7.366-6.189-.109zM.671 23.929l2.156 7.366 7.537-2.078-3.516-5.397-6.177.109z" fill="#E27625" />
                    </svg>
                  }
                  label="MetaMask"
                  onClick={login}
                />
                <LoginMethodButton
                  icon={
                    <svg width="18" height="18" viewBox="0 0 96 96" fill="none">
                      <rect width="96" height="96" rx="48" fill="#0052FF" />
                      <path d="M48 16c-17.673 0-32 14.327-32 32s14.327 32 32 32 32-14.327 32-32-14.327-32-32-32zm0 6c14.359 0 26 11.641 26 26S62.359 74 48 74 22 62.359 22 48s11.641-26 26-26z" fill="white" />
                    </svg>
                  }
                  label="Coinbase"
                  onClick={login}
                />
                <LoginMethodButton
                  icon={
                    <svg width="18" height="18" viewBox="0 0 100 100" fill="none">
                      <rect width="100" height="100" rx="20" fill="#3B99FC" />
                      <circle cx="50" cy="50" r="22" fill="white" />
                    </svg>
                  }
                  label="WalletConnect"
                  onClick={login}
                />
                <LoginMethodButton
                  icon={
                    <svg width="18" height="18" viewBox="0 0 100 100" fill="none">
                      <rect width="100" height="100" rx="20" fill="#7B3FE4" />
                      <path d="M26 62a24 24 0 0148-24v24H26z" fill="white" />
                    </svg>
                  }
                  label="Rainbow"
                  onClick={login}
                />
              </div>

              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "11.5px",
                  color: "var(--text-subtle)",
                  margin: "8px 0 0",
                  lineHeight: "1.65",
                  textAlign: "center",
                }}
              >
                Powered by Privy. Non-custodial — you own your keys.
              </p>
            </div>
          ) : (
            <div>
              {registryStatus === null ? (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 0" }}>
                  <div
                    style={{
                      width: "16px",
                      height: "16px",
                      border: "2px solid var(--border)",
                      borderTopColor: "var(--dirham-teal)",
                      borderRadius: "50%",
                      animation: "spin 0.7s linear infinite",
                      flexShrink: 0,
                    }}
                  />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "var(--ash)" }}>
                    Checking merchant registry…
                  </span>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--dirham-teal)", flexShrink: 0 }} />
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", color: "var(--dirham-teal)", fontWeight: 600 }}>
                      Signed in
                    </span>
                  </div>
                  {connectedAddress && <NotRegisteredState address={connectedAddress} />}
                </>
              )}

              <button
                onClick={logout}
                style={{
                  marginTop: "20px",
                  width: "100%",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--ash)",
                  background: "none",
                  border: "1.5px solid var(--border)",
                  padding: "10px 16px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                Sign out and try another account
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Back + docs links */}
      <div
        style={{
          position: "absolute",
          bottom: "24px",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: "20px",
          zIndex: 1,
        }}
      >
        <Link href="/" style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "var(--ash)", textDecoration: "none" }}>
          ← Back to home
        </Link>
        <Link href="/docs" style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "var(--ash)", textDecoration: "none" }}>
          Documentation
        </Link>
      </div>
    </div>
  );
}
