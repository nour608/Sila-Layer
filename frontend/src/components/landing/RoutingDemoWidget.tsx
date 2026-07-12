"use client";

import { useState } from "react";

type MerchantType = "mainland" | "difc";

interface Settlement {
  pays: string;
  receives: string;
  rail: "AED-PT" | "USDC";
  reason: string;
  railColor: string;
}

const SETTLEMENTS: Record<MerchantType, Settlement> = {
  mainland: {
    pays: "100.00 USDC",
    receives: "367.23 AED-PT",
    rail: "AED-PT",
    reason: "Mainland + RetailGoods → AED-PT required (PTSR §4.2: foreign payment tokens not permitted for retail goods on mainland UAE)",
    railColor: "var(--dirham-teal)",
  },
  difc: {
    pays: "100.00 USDC",
    receives: "100.00 USDC",
    rail: "USDC",
    reason: "DIFC merchant → USDC permitted (DIFC sits outside PTSR's direct scope; DFSA-regulated merchants not bound by mainland foreign-token restriction)",
    railColor: "#1C4A8A",
  },
};

export function RoutingDemoWidget() {
  const [selected, setSelected] = useState<MerchantType>("mainland");
  const s = SETTLEMENTS[selected];

  const btnBase: React.CSSProperties = {
    fontFamily: "var(--font-plex-sans)",
    fontSize: "13px",
    fontWeight: 500,
    padding: "9px 20px",
    border: "1px solid rgba(255,255,255,0.25)",
    cursor: "pointer",
    letterSpacing: "0.01em",
    transition: "all 0.12s ease",
  };

  const btnActive: React.CSSProperties = {
    ...btnBase,
    backgroundColor: "rgba(255,255,255,0.15)",
    color: "#fff",
    borderColor: "rgba(255,255,255,0.5)",
  };

  const btnInactive: React.CSSProperties = {
    ...btnBase,
    backgroundColor: "transparent",
    color: "rgba(255,255,255,0.5)",
    borderColor: "rgba(255,255,255,0.15)",
  };

  return (
    <div style={{ maxWidth: "560px" }}>
      {/* Toggle buttons */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button
          id="demo-mainland-btn"
          onClick={() => setSelected("mainland")}
          style={selected === "mainland" ? btnActive : btnInactive}
        >
          Mainland merchant
        </button>
        <button
          id="demo-difc-btn"
          onClick={() => setSelected("difc")}
          style={selected === "difc" ? btnActive : btnInactive}
        >
          DIFC merchant
        </button>
      </div>

      {/* Settlement preview card */}
      <div
        style={{
          backgroundColor: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          padding: "24px 28px",
        }}
      >
        {/* Flow line */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
          <div>
            <p style={{ fontFamily: "var(--font-plex-sans)", fontSize: "11px", color: "rgba(255,255,255,0.45)", margin: "0 0 4px", letterSpacing: "0.06em", textTransform: "uppercase" }}>Customer pays</p>
            <p className="font-mono" style={{ fontSize: "18px", fontWeight: 500, color: "#fff", margin: 0 }}>{s.pays}</p>
          </div>

          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "18px", flexShrink: 0, margin: "12px 4px 0" }}>→</div>

          <div>
            <p style={{ fontFamily: "var(--font-plex-sans)", fontSize: "11px", color: "rgba(255,255,255,0.45)", margin: "0 0 4px", letterSpacing: "0.06em", textTransform: "uppercase" }}>Merchant receives</p>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <p className="font-mono" style={{ fontSize: "18px", fontWeight: 500, color: "#fff", margin: 0 }}>{s.receives}</p>
              <span
                style={{
                  fontFamily: "var(--font-plex-sans)",
                  fontSize: "11px",
                  fontWeight: 500,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "#fff",
                  backgroundColor: s.railColor,
                  padding: "2px 8px",
                  borderRadius: "2px",
                }}
              >
                {s.rail}
              </span>
            </div>
          </div>
        </div>

        {/* Reason string */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: "16px",
          }}
        >
          <p style={{ fontFamily: "var(--font-plex-sans)", fontSize: "11px", color: "rgba(255,255,255,0.4)", margin: "0 0 6px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Compliance reason
          </p>
          <p
            style={{
              fontFamily: "var(--font-plex-sans)",
              fontSize: "12px",
              color: "rgba(255,255,255,0.65)",
              margin: 0,
              lineHeight: "1.7",
            }}
          >
            {s.reason}
          </p>
        </div>
      </div>

      <p style={{ fontFamily: "var(--font-plex-sans)", fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "12px" }}>
        This preview reflects the live routing logic. The reason string shown above appears verbatim on the merchant dashboard.
      </p>
    </div>
  );
}
