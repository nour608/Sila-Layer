// Compliance matrix: Zone × Purpose → required rail
// Source: MerchantRegistry.sol / PRD §2 / ARCHITECTURE.md §2.1
import type React from "react";

interface MatrixRow {
  zone: string;
  purpose: string;
  rail: "AED-PT" | "USDC";
  note: string;
}

const MATRIX: MatrixRow[] = [
  {
    zone: "Mainland",
    purpose: "RetailGoods",
    rail: "AED-PT",
    note: "Foreign payment tokens (USDC) not permitted for retail goods on mainland UAE under PTSR §4",
  },
  {
    zone: "Mainland",
    purpose: "VirtualAssetRelated",
    rail: "USDC",
    note: "PTSR carve-out: foreign tokens permitted for virtual-asset-related transactions",
  },
  {
    zone: "Mainland",
    purpose: "CrossBorderB2B",
    rail: "USDC",
    note: "Cross-border B2B treated as foreign-token-permitted under PTSR §6",
  },
  {
    zone: "DIFC",
    purpose: "RetailGoods",
    rail: "USDC",
    note: "DIFC sits outside PTSR's direct scope. DFSA-regulated merchants not subject to mainland foreign-token restriction.",
  },
  {
    zone: "DIFC",
    purpose: "VirtualAssetRelated",
    rail: "USDC",
    note: "Same DIFC exemption — USDC permitted for any purpose.",
  },
  {
    zone: "DIFC",
    purpose: "CrossBorderB2B",
    rail: "USDC",
    note: "Same DIFC exemption — USDC permitted for any purpose.",
  },
];

const RAIL_STYLE: Record<MatrixRow["rail"], React.CSSProperties> = {
  "AED-PT": {
    backgroundColor: "var(--dirham-teal)",
    color: "#fff",
    fontFamily: "var(--font-plex-sans)",
    fontSize: "11px",
    fontWeight: 500,
    padding: "2px 8px",
    borderRadius: "2px",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    display: "inline-block",
  },
  USDC: {
    backgroundColor: "#1C4A8A",
    color: "#fff",
    fontFamily: "var(--font-plex-sans)",
    fontSize: "11px",
    fontWeight: 500,
    padding: "2px 8px",
    borderRadius: "2px",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    display: "inline-block",
  },
};

export function ComplianceMatrix() {
  const thStyle: React.CSSProperties = {
    fontFamily: "'Inter', sans-serif",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: "var(--ash)",
    padding: "12px 16px",
    textAlign: "left",
    borderBottom: "1px solid var(--border)",
    backgroundColor: "var(--limestone)",
    whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    fontFamily: "'Inter', sans-serif",
    fontSize: "13.5px",
    color: "var(--text-primary)",
    padding: "13px 16px",
    borderBottom: "1px solid var(--border)",
    verticalAlign: "top",
  };

  return (
    <section
      id="compliance-matrix"
      style={{
        backgroundColor: "var(--surface)",
        padding: "80px 48px 120px",
      }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ marginBottom: "40px" }}>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ash)", margin: "0 0 12px" }}>
            Compliance matrix
          </p>
          <h2
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "clamp(26px, 3.5vw, 38px)",
              fontWeight: 800,
              color: "var(--text-primary)",
              margin: "0 0 16px",
              lineHeight: "1.15",
              letterSpacing: "-0.03em",
            }}
          >
            Zone × Purpose → Rail
          </h2>
        </div>
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "15px",
            color: "var(--ash)",
            margin: "0 0 28px",
            lineHeight: "1.7",
            maxWidth: "640px",
          }}
        >
          The table below encodes the routing logic exactly as it is implemented in{" "}
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
            MerchantRegistry.sol
          </code>
          . This is real regulatory information, not a marketing graphic.
        </p>


        <div
          style={{
            border: "1px solid var(--border)",
            backgroundColor: "#fff",
            overflowX: "auto",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Zone</th>
                <th style={thStyle}>Transaction purpose</th>
                <th style={thStyle}>Required rail</th>
                <th style={thStyle}>Regulatory basis</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((row, i) => (
                <tr key={i}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 500 }}>{row.zone}</span>
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "'IBM Plex Mono', monospace", fontSize: "12.5px" }}>
                    {row.purpose}
                  </td>
                  <td style={{ ...tdStyle }}>
                    <span style={RAIL_STYLE[row.rail]}>{row.rail}</span>
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      color: "var(--ash)",
                      fontSize: "12px",
                      maxWidth: "340px",
                    }}
                  >
                    {row.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "12px",
            color: "var(--ash)",
            marginTop: "14px",
          }}
        >
          PTSR = CBUAE Payment Token Services Regulation. DIFC = Dubai International Financial
          Centre. DFSA = Dubai Financial Services Authority. This table reflects the current
          implementation; it is not legal advice.
        </p>
      </div>
    </section>
  );
}
