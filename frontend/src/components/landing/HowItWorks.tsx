"use client";

const STEPS = [
  {
    n: "01",
    title: "Customer pays in any supported stablecoin",
    body: "The payer's wallet sends USDC or AED-PT to the router. They don't choose the output rail — that decision belongs to the compliance layer, not the user.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    n: "02",
    title: "Router checks merchant zone and transaction purpose",
    body: "SettlementRouter reads MerchantRegistry on-chain: what zone is this merchant in (Mainland or DIFC)? What purpose is declared (RetailGoods, VirtualAssetRelated, CrossBorderB2B)?",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    n: "03",
    title: "ConversionVault swaps assets if required",
    body: "If the payer's asset doesn't match the required rail, ConversionVault converts atomically. A mainlander paying in USDC for retail goods gets converted to AED-PT before settlement.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M7 16l-4-4 4-4M17 8l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 12h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    n: "04",
    title: "Merchant receives exactly the one compliant asset PTSR allows",
    body: "The Settled event is emitted with the rail, amount, and a plain-language reason string. This reason appears on the merchant dashboard — it's the audit trail that proves the routing decision was compliance-driven.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      style={{
        backgroundColor: "var(--limestone)",
        padding: "88px 48px",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {/* Section header */}
        <div style={{ marginBottom: "60px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "20px" }}>
          <div>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ash)", margin: "0 0 12px" }}>
              How it works
            </p>
            <h2
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "clamp(28px, 4vw, 40px)",
                fontWeight: 800,
                color: "var(--text-primary)",
                margin: 0,
                lineHeight: "1.15",
                letterSpacing: "-0.03em",
                maxWidth: "440px",
              }}
            >
              Settlement in four steps.
            </h2>
          </div>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "15px",
              color: "var(--ash)",
              maxWidth: "360px",
              lineHeight: "1.75",
              margin: 0,
            }}
          >
            Every payment flows through the same compliance-aware routing engine — automatically.
          </p>
        </div>

        {/* Steps grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1px",
            backgroundColor: "var(--border)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            overflow: "hidden",
          }}
        >
          {STEPS.map((step) => (
            <div
              key={step.n}
              style={{
                padding: "32px 28px",
                backgroundColor: "#fff",
                position: "relative",
                transition: "background 0.2s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(15,107,92,0.02)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "#fff";
              }}
            >
              {/* Icon */}
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(15,107,92,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--dirham-teal)",
                  marginBottom: "20px",
                }}
              >
                {step.icon}
              </div>

              {/* Number */}
              <span
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "11px",
                  color: "var(--dirham-teal)",
                  display: "block",
                  marginBottom: "10px",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                }}
              >
                {step.n}
              </span>

              <h3
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  margin: "0 0 12px",
                  lineHeight: "1.35",
                  letterSpacing: "-0.015em",
                }}
              >
                {step.title}
              </h3>
              <p
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "13.5px",
                  color: "var(--ash)",
                  margin: 0,
                  lineHeight: "1.7",
                }}
              >
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
