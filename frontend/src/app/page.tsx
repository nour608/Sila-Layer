import type { Metadata } from "next";
import Link from "next/link";
import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ComplianceMatrix } from "@/components/landing/ComplianceMatrix";
import { Navbar } from "@/components/ui/Navbar";

export const metadata: Metadata = {
  title: "Sila Layer — Compliant Stablecoin Settlement for UAE Merchants",
  description:
    "A settlement router that automatically routes each stablecoin payment to the legally-correct rail for your merchant zone. AED-PT for mainland retail, USDC where PTSR permits.",
};

export default function Home() {
  return (
    <main style={{ backgroundColor: "#fff" }}>
      <Navbar />
      <HeroSection />

      {/* ── How it works ── */}
      <div id="how-it-works">
        <HowItWorks />
      </div>

      {/* ── Compliance matrix ── */}
      <div id="compliance">
        <ComplianceMatrix />
      </div>

      {/* ── Footer ── */}
      <footer
        style={{
          backgroundColor: "var(--text-primary)",
          padding: "48px 48px 32px",
          color: "rgba(255,255,255,0.7)",
        }}
      >
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto",
          }}
        >
          {/* Top row */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "32px",
              marginBottom: "48px",
            }}
          >
            {/* Brand */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "12px" }}>
                <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
                  <rect width="28" height="28" rx="6" fill="var(--dirham-teal)" />
                  <path d="M8 19.5c0-1.5 1-2.5 3-3l5-1.2c2-.5 3-1.8 3-3.3 0-1.8-1.4-3-3.5-3-2.2 0-3.7 1.2-3.7 3H9.2C9.2 9.5 11.3 8 14.6 8c3.2 0 5.4 1.8 5.4 4.5 0 2.2-1.3 3.8-3.8 4.4L11.5 18c-1.3.3-1.9.9-1.9 1.8H20V21H8v-1.5z" fill="white" />
                </svg>
                <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: "16px", color: "#fff", letterSpacing: "-0.03em" }}>
                  Sila Layer
                </span>
              </div>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.45)", maxWidth: "260px", lineHeight: "1.7", margin: 0 }}>
                Compliant stablecoin settlement routing for UAE merchants. PTSR-aware. Zone-native.
              </p>
            </div>

            {/* Links */}
            <div style={{ display: "flex", gap: "48px", flexWrap: "wrap" }}>
              <div>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", margin: "0 0 14px" }}>
                  Product
                </p>
                {[
                  { label: "How it works", href: "/#how-it-works" },
                  { label: "Compliance", href: "/#compliance" },
                  { label: "Documentation", href: "/docs" },
                ].map((l) => (
                  <Link key={l.href} href={l.href} style={{ display: "block", fontFamily: "'Inter', sans-serif", fontSize: "14px", color: "rgba(255,255,255,0.6)", marginBottom: "10px", textDecoration: "none" }}>
                    {l.label}
                  </Link>
                ))}
              </div>
              <div>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", margin: "0 0 14px" }}>
                  Access
                </p>
                {[
                  { label: "Merchant sign-in", href: "/login" },
                  { label: "Talk to us", href: "mailto:hello@silalayer.xyz" },
                ].map((l) => (
                  <Link key={l.href} href={l.href} style={{ display: "block", fontFamily: "'Inter', sans-serif", fontSize: "14px", color: "rgba(255,255,255,0.6)", marginBottom: "10px", textDecoration: "none" }}>
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.08)",
              paddingTop: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "12px",
                color: "rgba(255,255,255,0.3)",
                margin: 0,
                lineHeight: "1.6",
                maxWidth: "640px",
              }}
            >
              Built for the DIFC/Ignyte &ldquo;Merchant Payments Need a Blockchain-Native Layer&rdquo; hackathon
              track. Runs on Polygon Amoy testnet — no real funds at risk. AED-PT is a disclosed
              simulated token. This is not a licensed payment service.
            </p>
            <Link
              href="/login"
              id="footer-cta-signin"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "13px",
                fontWeight: 500,
                color: "#fff",
                backgroundColor: "var(--dirham-teal)",
                padding: "9px 18px",
                borderRadius: "var(--radius-pill)",
                textDecoration: "none",
              }}
            >
              Merchant sign-in →
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
