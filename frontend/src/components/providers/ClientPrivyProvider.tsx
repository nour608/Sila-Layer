"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { polygonAmoy } from "@/lib/contracts";

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

const wagmiConfig = createConfig({
  chains: [polygonAmoy],
  transports: {
    [polygonAmoy.id]: http(),
  },
});

function MissingConfigFallback() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--limestone)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "420px",
          width: "100%",
          backgroundColor: "var(--paper)",
          border: "1px solid var(--border)",
          borderLeft: "4px solid var(--rust)",
          borderRadius: "8px",
          padding: "32px",
        }}
      >
        <h1
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "16px",
            fontWeight: 600,
            color: "var(--ink)",
            margin: "0 0 10px",
          }}
        >
          Missing Privy app ID
        </h1>
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "14px",
            color: "var(--ash)",
            margin: "0 0 12px",
            lineHeight: "1.6",
          }}
        >
          Create a{" "}
          <code
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "12px",
              backgroundColor: "var(--limestone)",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              padding: "2px 6px",
            }}
          >
            frontend/.env.local
          </code>{" "}
          file and set{" "}
          <code
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "12px",
              backgroundColor: "var(--limestone)",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              padding: "2px 6px",
            }}
          >
            NEXT_PUBLIC_PRIVY_APP_ID
          </code>
          .
        </p>
      </div>
    </main>
  );
}

export function ClientPrivyProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const router = useRouter();

  if (!privyAppId) {
    return <MissingConfigFallback />;
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      onSuccess={() => router.push("/dashboard")}
      config={{
        // ── Expanded login methods: social + wallets ──
        loginMethods: [
          "email",
          "wallet",
          "google",
          "twitter",
          "discord",
          "apple",
          "github",
        ],
        appearance: {
          theme: "light",
          accentColor: "#0F6B5C",
          logo: "/sila-logo.svg",
          // Show wallet options (MetaMask, WalletConnect, Coinbase, etc.) prominently
          showWalletLoginFirst: true,
          walletList: [
            "metamask",
            "coinbase_wallet",
            "rainbow",
            "wallet_connect",
            "detected_wallets",
          ],
        },
        embeddedWallets: {
          ethereum: {
            // Create an embedded wallet for every user who signs in via social/email
            createOnLogin: "users-without-wallets",
          },
        },
        // Optionally wire in WalletConnect cloud project if env var is set
        walletConnectCloudProjectId:
          process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
        defaultChain: polygonAmoy,
        supportedChains: [polygonAmoy],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
