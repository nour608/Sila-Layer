"use client";

import type React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useTheme } from "@/components/providers/ThemeProvider";

function ComplianceSimulator() {
  const [zone, setZone] = useState("Mainland");
  const [purpose, setPurpose] = useState("RetailGoods");
  const [amount, setAmount] = useState("150");
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<{
    rail: string;
    reason: string;
    color: string;
  } | null>(null);

  const handleSimulate = () => {
    setIsSimulating(true);
    setResult(null);

    // Simulate network/contract delay for the "shiny" feel
    setTimeout(() => {
      if (zone === "DIFC") {
        setResult({
          rail: "USDC (Foreign Payment Token)",
          reason:
            "DIFC merchants sit outside mainland PTSR scope. USDC settlement is permitted for all transactions.",
          color: "var(--usdc-navy, #1C4A8A)",
        });
      } else if (zone === "Mainland" && purpose === "RetailGoods") {
        setResult({
          rail: "AED-PT (Dirham Payment Token)",
          reason:
            "Mainland retail transactions strictly require Dirham Payment Tokens under CBUAE PTSR. Foreign stablecoins blocked.",
          color: "var(--dirham-teal, #0F6B5C)",
        });
      } else {
        setResult({
          rail: "USDC (Foreign Payment Token)",
          reason:
            "Mainland merchants may accept foreign tokens specifically for Virtual Asset or designated B2B purposes.",
          color: "var(--usdc-navy, #1C4A8A)",
        });
      }
      setIsSimulating(false);
    }, 800);
  };

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "24px",
        background: "var(--surface)",
        marginTop: "32px",
        marginBottom: "32px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
      }}
    >
      <div
        style={{
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <div
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: "var(--dirham-teal, #0F6B5C)",
          }}
        ></div>
        <h3
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "15px",
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          Interactive Routing Simulator
        </h3>
      </div>

      <div
        style={{
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        <div style={{ flex: "1 1 200px" }}>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--ash)",
              marginBottom: "6px",
            }}
          >
            Merchant Zone
          </label>
          <select
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "var(--surface-alt)",
              fontFamily: "'Inter', sans-serif",
              fontSize: "14px",
              color: "var(--text-primary)",
            }}
          >
            <option value="Mainland">Mainland UAE</option>
            <option value="DIFC">DIFC / ADGM</option>
          </select>
        </div>

        <div style={{ flex: "1 1 200px" }}>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--ash)",
              marginBottom: "6px",
            }}
          >
            Transaction Purpose
          </label>
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "var(--surface-alt)",
              fontFamily: "'Inter', sans-serif",
              fontSize: "14px",
              color: "var(--text-primary)",
            }}
          >
            <option value="RetailGoods">Retail Goods & Services</option>
            <option value="VirtualAsset">Virtual Asset Related</option>
            <option value="B2B">Cross-Border B2B</option>
          </select>
        </div>

        <div style={{ flex: "1 1 120px" }}>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--ash)",
              marginBottom: "6px",
            }}
          >
            Amount ($)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "var(--surface-alt)",
              fontFamily: "'Inter', sans-serif",
              fontSize: "14px",
              color: "var(--text-primary)",
            }}
          />
        </div>
      </div>

      <button
        onClick={handleSimulate}
        disabled={isSimulating}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: "6px",
          border: "none",
          background: "var(--text-primary)",
          color: "#fff",
          fontFamily: "'Inter', sans-serif",
          fontSize: "14px",
          fontWeight: 600,
          cursor: isSimulating ? "wait" : "pointer",
          transition: "opacity 0.2s",
          opacity: isSimulating ? 0.7 : 1,
        }}
      >
        {isSimulating
          ? "Analyzing On-Chain Compliance..."
          : "Simulate Payment Routing"}
      </button>

      {result && (
        <div
          style={{
            marginTop: "24px",
            padding: "16px",
            borderRadius: "8px",
            background: "rgba(249,250,251,1)",
            border: "1px dashed var(--border)",
            animation: "fadeIn 0.3s ease-in-out",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ash)",
              marginBottom: "8px",
            }}
          >
            Settlement Result
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            <span style={{ fontSize: "18px" }}>↳</span>
            <span
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "14px",
                fontWeight: 600,
                color: result.color,
                padding: "4px 8px",
                background: `${result.color}15`,
                borderRadius: "4px",
              }}
            >
              Settled in {result.rail}
            </span>
          </div>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "13px",
              color: "var(--ash)",
              lineHeight: "1.6",
              margin: 0,
            }}
          >
            <strong style={{ color: "var(--text-primary)" }}>
              Router Reason:
            </strong>{" "}
            {result.reason}
          </p>
        </div>
      )}
    </div>
  );
}
// ─── Sidebar nav data ─────────────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    id: "architecture",
    label: "Architecture",
    icon: "⬡",
    children: [
      { id: "settlement-router", label: "SettlementRouter" },
      { id: "merchant-registry", label: "MerchantRegistry" },
      { id: "conversion-vault", label: "ConversionVault" },
      { id: "off-chain", label: "Off-chain trigger" },
    ],
  },
  {
    id: "regulatory",
    label: "Regulatory Model",
    icon: "⚖",
    children: [
      { id: "dirham-tokens", label: "Dirham Payment Tokens" },
      { id: "foreign-tokens", label: "Foreign Payment Tokens" },
      { id: "difc", label: "DIFC distinction" },
    ],
  },
  {
    id: "roadmap",
    label: "Roadmap",
    icon: "◎",
    children: [
      { id: "phase-1", label: "Phase 1 — MVP" },
      { id: "phase-2", label: "Phase 2 — Production" },
      { id: "phase-3", label: "Phase 3 — Extended" },
    ],
  },
];
// ─── All section IDs for scroll spy ───────────────────────────────────────────
const ALL_SECTION_IDS = [
  "architecture",
  "settlement-router",
  "merchant-registry",
  "conversion-vault",
  "off-chain",
  "regulatory",
  "dirham-tokens",
  "foreign-tokens",
  "difc",
  "roadmap",
  "phase-1",
  "phase-2",
  "phase-3",
];

// Map child IDs to parent section IDs for auto-expand
const CHILD_TO_PARENT: Record<string, string> = {};
NAV_SECTIONS.forEach((s) => {
  s.children.forEach((c) => {
    CHILD_TO_PARENT[c.id] = s.id;
  });
});

// ─── Theme toggle button ─────────────────────────────────────────────────────
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "32px",
        height: "32px",
        borderRadius: "var(--radius-pill)",
        border: "1px solid var(--border)",
        background: "var(--surface-alt)",
        cursor: "pointer",
        transition: "all 0.2s ease",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--dirham-teal)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      {theme === "light" ? (
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path
            d="M7.5 1v1.5M7.5 12.5V14M2.7 2.7l1.1 1.1M11.2 11.2l1.1 1.1M1 7.5h1.5M12.5 7.5H14M2.7 12.3l1.1-1.1M11.2 3.8l1.1-1.1"
            stroke="var(--text-primary)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <circle cx="7.5" cy="7.5" r="3" fill="var(--text-primary)" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path
            d="M13.5 8.2A5.7 5.7 0 016.8 1.5a5.7 5.7 0 106.7 6.7z"
            fill="var(--dirham-teal)"
          />
        </svg>
      )}
    </button>
  );
}

// ─── Sidebar component ────────────────────────────────────────────────────────
function DocsSidebar({
  activeSection,
  onSelect,
}: {
  activeSection: string;
  onSelect: (id: string) => void;
}) {
  const { login } = usePrivy();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    architecture: true,
    regulatory: false,
    roadmap: false,
  });
  const [searchQuery, setSearchQuery] = useState("");

  // Auto-expand parent when a child becomes active via scroll spy
  useEffect(() => {
    const parent = CHILD_TO_PARENT[activeSection];
    if (parent && !expanded[parent]) {
      setExpanded((prev) => ({ ...prev, [parent]: true }));
    }
  }, [activeSection]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSection = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelect = (id: string) => {
    onSelect(id);
    const el = document.getElementById(id);
    if (el) {
      const offset = 80;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  // Filter sections based on search
  const filteredSections = NAV_SECTIONS.filter((section) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (section.label.toLowerCase().includes(q)) return true;
    return section.children.some((c) => c.label.toLowerCase().includes(q));
  }).map((section) => {
    if (!searchQuery) return section;
    const q = searchQuery.toLowerCase();
    return {
      ...section,
      children: section.children.filter((c) =>
        c.label.toLowerCase().includes(q),
      ),
    };
  });

  // Find the active parent's children for "On this page"
  const activeParent =
    CHILD_TO_PARENT[activeSection] ||
    NAV_SECTIONS.find((s) => s.id === activeSection && s.children.length > 0)
      ?.id;
  const activeParentSection = NAV_SECTIONS.find((s) => s.id === activeParent);

  return (
    <aside className="docs-sidebar">
      {/* Logo */}
      <div
        style={{
          padding: "20px 20px 16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            textDecoration: "none",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="5" fill="var(--dirham-teal)" />
            <path
              d="M8 19.5c0-1.5 1-2.5 3-3l5-1.2c2-.5 3-1.8 3-3.3 0-1.8-1.4-3-3.5-3-2.2 0-3.7 1.2-3.7 3H9.2C9.2 9.5 11.3 8 14.6 8c3.2 0 5.4 1.8 5.4 4.5 0 2.2-1.3 3.8-3.8 4.4L11.5 18c-1.3.3-1.9.9-1.9 1.8H20V21H8v-1.5z"
              fill="white"
            />
          </svg>
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              fontSize: "14px",
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
            }}
          >
            Sila Layer
          </span>
        </Link>
      </div>

      {/* Search */}
      <div style={{ padding: "10px 12px 6px" }}>
        <div style={{ position: "relative" }}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 13 13"
            fill="none"
            style={{
              position: "absolute",
              left: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              opacity: 0.5,
            }}
          >
            <circle
              cx="5.5"
              cy="5.5"
              r="4"
              stroke="var(--ash)"
              strokeWidth="1.2"
            />
            <path
              d="M8.5 8.5L12 12"
              stroke="var(--ash)"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search docs..."
            style={{
              width: "100%",
              padding: "7px 10px 7px 28px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "var(--surface-alt)",
              fontFamily: "'Inter', sans-serif",
              fontSize: "12.5px",
              color: "var(--text-primary)",
              outline: "none",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--dirham-teal)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--border)";
            }}
          />
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ padding: "8px 8px", flex: 1, overflowY: "auto" }}>
        {filteredSections.length === 0 && (
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "12px",
              color: "var(--text-subtle)",
              padding: "12px",
              margin: 0,
            }}
          >
            No results found.
          </p>
        )}
        {filteredSections.map((section) => (
          <div key={section.id} style={{ marginBottom: "2px" }}>
            <button
              onClick={() => {
                toggleSection(section.id);
                handleSelect(section.id);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "7px 12px",
                borderRadius: "6px",
                border: "none",
                background:
                  activeSection === section.id
                    ? "rgba(15,107,92,0.08)"
                    : "transparent",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.15s",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  width: "16px",
                  textAlign: "center",
                  color:
                    activeSection === section.id
                      ? "var(--dirham-teal)"
                      : "var(--text-subtle)",
                  flexShrink: 0,
                  fontFamily: "system-ui",
                }}
              >
                {expanded[section.id] && section.children.length > 0
                  ? "▾"
                  : "›"}
              </span>
              <span
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "13px",
                  fontWeight: activeSection === section.id ? 600 : 500,
                  color:
                    activeSection === section.id
                      ? "var(--dirham-teal)"
                      : "var(--text-primary)",
                }}
              >
                {section.label}
              </span>
            </button>

            {expanded[section.id] && section.children.length > 0 && (
              <div
                style={{
                  marginLeft: "12px",
                  paddingLeft: "16px",
                  borderLeft: "1px solid var(--border)",
                }}
              >
                {section.children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => handleSelect(child.id)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "5px 12px",
                      borderRadius: "5px",
                      border: "none",
                      background:
                        activeSection === child.id
                          ? "rgba(15,107,92,0.07)"
                          : "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "'Inter', sans-serif",
                      fontSize: "13px",
                      fontWeight: 400,
                      color:
                        activeSection === child.id
                          ? "var(--dirham-teal)"
                          : "var(--ash)",
                      transition: "all 0.15s",
                    }}
                  >
                    {activeSection === child.id && (
                      <span
                        style={{
                          width: "4px",
                          height: "4px",
                          borderRadius: "50%",
                          background: "var(--dirham-teal)",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    {child.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* On this page */}
        {activeParentSection && activeParentSection.children.length > 0 && (
          <div
            style={{
              marginTop: "16px",
              padding: "12px 12px",
              borderTop: "1px solid var(--border)",
            }}
          >
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "10px",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--text-subtle)",
                margin: "0 0 8px",
              }}
            >
              On this page
            </p>
            {activeParentSection.children.map((child) => (
              <button
                key={child.id}
                onClick={() => handleSelect(child.id)}
                style={{
                  width: "100%",
                  display: "block",
                  padding: "3px 0",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "11.5px",
                  fontWeight: activeSection === child.id ? 500 : 400,
                  color:
                    activeSection === child.id
                      ? "var(--dirham-teal)"
                      : "var(--text-subtle)",
                  transition: "color 0.15s",
                }}
              >
                {child.label}
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Bottom: Sign in */}
      <div
        style={{
          padding: "16px 12px",
          borderTop: "1px solid var(--border)",
          marginTop: "auto",
        }}
      >
        <button
          onClick={login}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "9px 12px",
            borderRadius: "6px",
            border: "none",
            backgroundColor: "transparent",
            fontFamily: "'Inter', sans-serif",
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--ash)",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.backgroundColor = "var(--surface-alt)";
            el.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.backgroundColor = "transparent";
            el.style.color = "var(--ash)";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M5 2H2a1 1 0 00-1 1v8a1 1 0 001 1h3M9.5 9.5L12 7m0 0L9.5 4.5M12 7H5"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Sign in
        </button>
      </div>
    </aside>
  );
}

// ─── Content helpers ──────────────────────────────────────────────────────────
function P({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: "15px",
        color: "var(--ash)",
        lineHeight: "1.8",
        margin: "0 0 18px",
      }}
    >
      {children}
    </p>
  );
}

function Callout({
  children,
  type = "info",
}: {
  children: React.ReactNode;
  type?: "info" | "warning";
}) {
  const colors = {
    info: {
      bg: "rgba(15,107,92,0.05)",
      border: "var(--dirham-teal)",
      text: "var(--dirham-teal)",
    },
    warning: {
      bg: "rgba(176,141,87,0.07)",
      border: "var(--brass)",
      text: "var(--brass)",
    },
  }[type];

  return (
    <div
      style={{
        background: colors.bg,
        borderLeft: `3px solid ${colors.border}`,
        borderRadius: "0 6px 6px 0",
        padding: "14px 18px",
        margin: "20px 0",
      }}
    >
      <p
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: "13.5px",
          color: colors.text,
          lineHeight: "1.7",
          margin: 0,
        }}
      >
        {children}
      </p>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: "relative",
        margin: "18px 0",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid var(--border)",
      }}
    >
      <button
        onClick={handleCopy}
        style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          padding: "4px 10px",
          borderRadius: "4px",
          border: "1px solid var(--border)",
          background: "var(--surface)",
          fontFamily: "'Inter', sans-serif",
          fontSize: "11px",
          color: copied ? "var(--dirham-teal)" : "var(--ash)",
          cursor: "pointer",
          transition: "all 0.15s",
          zIndex: 1,
        }}
      >
        {copied ? "✓ Copied" : "Copy"}
      </button>
      <pre
        style={{
          margin: 0,
          padding: "16px 20px",
          background: "var(--surface-alt)",
          overflowX: "auto",
        }}
      >
        <code
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "12.5px",
            color: "var(--text-primary)",
            lineHeight: "1.6",
          }}
        >
          {children}
        </code>
      </pre>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "12.5px",
        backgroundColor: "var(--surface-alt)",
        border: "1px solid var(--border)",
        borderRadius: "4px",
        padding: "2px 6px",
        color: "var(--dirham-teal)",
      }}
    >
      {children}
    </code>
  );
}

function ContractCard({
  name,
  description,
}: {
  name: string;
  description: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "22px 26px",
        marginBottom: "16px",
        background: "var(--surface)",
      }}
    >
      <h3
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "13px",
          fontWeight: 600,
          color: "var(--dirham-teal)",
          margin: "0 0 12px",
        }}
      >
        {name}
      </h3>
      <P>{description}</P>
    </div>
  );
}

// ─── Roadmap phases ───────────────────────────────────────────────────────────
const PHASES = [
  {
    number: "Phase 1",
    title: "Hackathon MVP (now)",
    items: [
      "SettlementRouter.sol — compliance-aware routing",
      "MerchantRegistry.sol — Mainland/DIFC zone registration",
      "ConversionVault.sol — seeded testnet liquidity",
      "MockAEDPT.sol — simulated AED Payment Token",
      "Chainlink CRE decentralized workflow",
    ],
    status: "current",
  },
  {
    number: "Phase 2",
    title: "The Payment Master Upgrade",
    items: [
      "Zero-Knowledge (ZK) Compliance Sandbox Preview",
      "Enterprise Privacy: ZK proofs for Travel Rule compliance",
      "Payroll & Supplier settlement routing",
      "Real AE Coin integration (CBUAE sandbox)",
    ],
    status: "roadmap",
  },
  {
    number: "Phase 3",
    title: "Extended compliance rails",
    items: [
      "Comprehensive B2B Treasury Dashboard",
      "White-label SDK for POS platforms",
      "Multi-chain support (Base, Arbitrum)",
    ],
    status: "roadmap",
  },
];

// ─── Main docs page ───────────────────────────────────────────────────────────
export default function DocsPage() {
  const { login } = usePrivy();
  const [activeSection, setActiveSection] = useState("architecture");
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // ── Scroll spy via IntersectionObserver ──────────────────────────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry that is most visible / intersecting near the top
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          const id = visible[0].target.id;
          if (id) {
            setActiveSection(id);
          }
        }
      },
      {
        rootMargin: "-80px 0px -70% 0px",
        threshold: 0,
      },
    );

    ALL_SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // ── Reading progress bar + back-to-top ───────────────────────────────────
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setScrollProgress(progress);
      setShowBackToTop(scrollTop > 600);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="docs-layout" style={{ fontFamily: "'Inter', sans-serif" }}>
      <DocsSidebar activeSection={activeSection} onSelect={setActiveSection} />

      <div className="docs-main">
        {/* Reading progress bar */}
        <div
          style={{
            position: "fixed",
            top: 0,
            left: "240px",
            right: 0,
            height: "3px",
            background: "var(--dirham-teal)",
            width: `${scrollProgress}%`,
            zIndex: 100,
            transition: "width 0.1s ease-out",
          }}
        />

        {/* Top nav bar */}
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            backgroundColor: "var(--surface)",
            opacity: 0.95,
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            borderBottom: "1px solid var(--border)",
            padding: "0 40px",
            height: "56px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", color: "var(--text-subtle)" }}>
              Documentation
            </span>
            <span style={{ fontSize: "13px", color: "var(--text-subtle)" }}>
              ›
            </span>
            <span
              style={{
                fontSize: "13px",
                color: "var(--text-primary)",
                fontWeight: 500,
                textTransform: "capitalize",
              }}
            >
              {activeSection.replace(/-/g, " ")}
            </span>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <ThemeToggle />
            <Link
              href="/"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "13px",
                color: "var(--ash)",
                textDecoration: "none",
                padding: "6px 14px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-pill)",
              }}
            >
              ← Home
            </Link>
            <button
              onClick={login}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "13px",
                fontWeight: 500,
                color: "#fff",
                backgroundColor: "var(--dirham-teal)",
                padding: "6px 16px",
                borderRadius: "var(--radius-pill)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Merchant sign-in →
            </button>
          </div>
        </header>

        {/* Article content */}
        <main
          ref={mainRef}
          style={{
            maxWidth: "800px",
            margin: "0 auto",
            padding: "52px 48px 100px",
          }}
        >
          {/* Page heading */}
          <div style={{ marginBottom: "60px" }}>
            <p
              style={{
                fontSize: "12px",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--ash)",
                margin: "0 0 16px",
              }}
            >
              Technical Documentation
            </p>
            <h1
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "clamp(28px, 4vw, 42px)",
                fontWeight: 800,
                color: "var(--text-primary)",
                margin: "0 0 16px",
                letterSpacing: "-0.03em",
                lineHeight: 1.15,
              }}
            >
              Sila Layer Documentation
            </h1>
            <p
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "16px",
                color: "var(--ash)",
                maxWidth: "560px",
                lineHeight: "1.7",
                margin: 0,
              }}
            >
              Architecture, regulatory model, and roadmap for the Sila Layer
              stablecoin settlement router. Built for the DIFC/Ignyte hackathon
              on Polygon Amoy testnet.
            </p>
          </div>

          {/* ─── Architecture ─────────────────────────────────────────────── */}
          <section id="architecture" style={{ marginBottom: "72px" }}>
            <p
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--ash)",
                margin: "0 0 10px",
              }}
            >
              Section 1
            </p>
            <h2
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "clamp(22px, 3vw, 30px)",
                fontWeight: 800,
                color: "var(--text-primary)",
                margin: "0 0 24px",
                letterSpacing: "-0.025em",
                lineHeight: 1.2,
              }}
            >
              Architecture
            </h2>
            <P>
              Sila Layer is a three-contract settlement system that sits between
              a merchant's point-of-sale system and the blockchain. Each
              component has a single responsibility.
            </P>

            <ComplianceSimulator />
            <div id="settlement-router" style={{ marginTop: "32px" }}>
              <ContractCard
                name="SettlementRouter.sol"
                description={
                  <>
                    The entry point for every payment. When a Square checkout
                    completes, the CRE workflow (or fallback relayer) calls{" "}
                    <Code>
                      settle(merchant, payer, payerAsset, amount, purpose)
                    </Code>
                    . The router reads <Code>MerchantRegistry</Code> to
                    determine the legally-required rail — if the payer's asset
                    doesn't match, it calls <Code>ConversionVault.swap()</Code>{" "}
                    to convert before sending to the merchant. A{" "}
                    <Code>Settled</Code> event is emitted with the rail,
                    amounts, purpose, and a human-readable reason string that
                    forms the audit trail.
                  </>
                }
              />

              <div id="merchant-registry">
                <ContractCard
                  name="MerchantRegistry.sol"
                  description={
                    <>
                      The on-chain source of truth for merchant compliance
                      status. Each merchant address is associated with a{" "}
                      <Code>Zone</Code> (Unregistered, Mainland, or DIFC), an
                      active flag, and a human-readable label. The core query is{" "}
                      <Code>isForeignTokenPermitted(merchant, purpose)</Code> —
                      returns <Code>true</Code> if that merchant may receive
                      USDC, or <Code>false</Code> if only AED-PT is allowed.
                    </>
                  }
                />
              </div>

              <div id="conversion-vault">
                <ContractCard
                  name="ConversionVault.sol"
                  description={
                    <>
                      A seeded testnet liquidity pool for swapping between
                      AED-PT and USDC at an owner-set exchange rate. The swap is
                      atomic — it either completes in full or reverts. The vault
                      handles the decimal gap between AED-PT (2 decimals) and
                      USDC (6 decimals) explicitly.
                    </>
                  }
                />
                <Callout type="warning">
                  Disclosure: The exchange rate is owner-set, not
                  oracle-sourced. AED-PT is a simulated token — no public AE
                  Coin developer sandbox exists at time of submission.
                </Callout>
              </div>
            </div>

            <div id="off-chain" style={{ marginTop: "24px" }}>
              <P>
                The off-chain trigger is a Chainlink CRE workflow (TypeScript
                SDK) or a Node.js fallback relayer if CRE Early Access is
                unavailable. Both poll the Square payments API on a cron and
                call <Code>SettlementRouter.settle()</Code> with a funded
                testnet wallet.
              </P>
            </div>
          </section>

          {/* ─── Regulatory model ──────────────────────────────────────────── */}
          <section
            id="regulatory"
            style={{
              paddingTop: "60px",
              borderTop: "1px solid var(--border)",
              marginBottom: "72px",
            }}
          >
            <p
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--ash)",
                margin: "0 0 10px",
              }}
            >
              Section 2
            </p>
            <h2
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "clamp(22px, 3vw, 30px)",
                fontWeight: 800,
                color: "var(--text-primary)",
                margin: "0 0 24px",
                letterSpacing: "-0.025em",
                lineHeight: 1.2,
              }}
            >
              Regulatory Model
            </h2>
            <P>
              The compliance logic derives from CBUAE's Payment Token Services
              Regulation (PTSR). PTSR applies to mainland UAE and draws a hard
              line between two categories of payment token.
            </P>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                margin: "28px 0",
              }}
            >
              <div
                id="dirham-tokens"
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "20px 22px",
                  background: "rgba(15,107,92,0.03)",
                }}
              >
                <h3
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--dirham-teal)",
                    margin: "0 0 10px",
                  }}
                >
                  Dirham Payment Tokens (AED-PT)
                </h3>
                <P>
                  CBUAE-licensed, AED-pegged stablecoins. A mainland merchant
                  may accept these for any transaction purpose. The simulated{" "}
                  <Code>MockAEDPT</Code> stands in for AE Coin.
                </P>
              </div>
              <div
                id="foreign-tokens"
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "20px 22px",
                  background: "rgba(28,74,138,0.03)",
                }}
              >
                <h3
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--usdc-navy)",
                    margin: "0 0 10px",
                  }}
                >
                  Foreign Payment Tokens (USDC)
                </h3>
                <P>
                  Non-AED-pegged stablecoins. Under PTSR, a mainland merchant
                  may only accept these for virtual-asset transactions or
                  cross-border B2B — not ordinary retail goods.
                </P>
              </div>
            </div>

            <div id="difc">
              <h3
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  margin: "32px 0 14px",
                  letterSpacing: "-0.02em",
                }}
              >
                The DIFC distinction
              </h3>
              <P>
                DIFC and ADGM are special economic zones with their own
                financial regulators (DFSA and FSRA). A DIFC merchant can
                receive USDC for any transaction purpose. This is the key
                regulatory distinction that <Code>MerchantRegistry</Code>{" "}
                encodes as a <Code>Zone</Code> discriminant.
              </P>
              <Callout type="warning">
                This system is a routing/orchestration layer. It does not verify
                licensing — that is admin-attested for this MVP. A real
                production deployment would require integration with a licensed
                payment service provider.
              </Callout>
            </div>
          </section>

          {/* ─── Roadmap ───────────────────────────────────────────────────── */}
          <section
            id="roadmap"
            style={{
              paddingTop: "60px",
              borderTop: "1px solid var(--border)",
            }}
          >
            <p
              style={{
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--ash)",
                margin: "0 0 10px",
              }}
            >
              Section 3
            </p>
            <h2
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "clamp(22px, 3vw, 30px)",
                fontWeight: 800,
                color: "var(--text-primary)",
                margin: "0 0 24px",
                letterSpacing: "-0.025em",
                lineHeight: 1.2,
              }}
            >
              Roadmap
            </h2>
            <P>
              Three staged phases. Phase 1 is what exists now. Phases 2 and 3
              are described as direction, not commitments — each depends on
              external factors.
            </P>

            <div style={{ marginTop: "32px" }}>
              {PHASES.map((phase, i) => (
                <div
                  key={i}
                  id={`phase-${i + 1}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "150px 1fr",
                    gap: "0 28px",
                    borderTop: "1px solid var(--border)",
                    padding: "28px 0",
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: "11px",
                        color:
                          phase.status === "current"
                            ? "var(--dirham-teal)"
                            : "var(--ash)",
                        fontWeight: 600,
                        display: "block",
                        marginBottom: "5px",
                      }}
                    >
                      {phase.number}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        display: "block",
                        lineHeight: "1.35",
                      }}
                    >
                      {phase.title}
                    </span>
                    {phase.status === "current" && (
                      <span
                        style={{
                          display: "inline-block",
                          marginTop: "10px",
                          fontFamily: "'Inter', sans-serif",
                          fontSize: "10px",
                          fontWeight: 600,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "var(--dirham-teal)",
                          border: "1.5px solid var(--dirham-teal)",
                          padding: "2px 8px",
                          borderRadius: "3px",
                        }}
                      >
                        Built
                      </span>
                    )}
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      padding: 0,
                      listStyle: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    {phase.items.map((item, j) => (
                      <li
                        key={j}
                        style={{
                          display: "flex",
                          gap: "10px",
                          alignItems: "flex-start",
                        }}
                      >
                        <span
                          style={{
                            color:
                              phase.status === "current"
                                ? "var(--dirham-teal)"
                                : "var(--border)",
                            marginTop: "2px",
                            flexShrink: 0,
                            fontSize: "13px",
                          }}
                        >
                          {phase.status === "current" ? "✓" : "○"}
                        </span>
                        <span
                          style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: "14px",
                            color: "var(--ash)",
                            lineHeight: "1.6",
                            opacity: phase.status === "current" ? 1 : 0.75,
                          }}
                        >
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>

      {/* Back to top button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          aria-label="Back to top"
          style={{
            position: "fixed",
            bottom: "32px",
            right: "32px",
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            boxShadow: "var(--shadow-md)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            transition: "all 0.2s ease",
            animation: "fadeIn 0.2s ease forwards",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--dirham-teal)";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 13V3M4 7l4-4 4 4"
              stroke="var(--dirham-teal)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
