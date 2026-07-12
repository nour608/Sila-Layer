"use client";

import Link from "next/link";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

// ─── Logo ─────────────────────────────────────────────────────────────────────
function SilaLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
      <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
        <rect width="28" height="28" rx="6" fill="var(--dirham-teal)" />
        <path
          d="M8 19.5c0-1.5 1-2.5 3-3l5-1.2c2-.5 3-1.8 3-3.3 0-1.8-1.4-3-3.5-3-2.2 0-3.7 1.2-3.7 3H9.2C9.2 9.5 11.3 8 14.6 8c3.2 0 5.4 1.8 5.4 4.5 0 2.2-1.3 3.8-3.8 4.4L11.5 18c-1.3.3-1.9.9-1.9 1.8H20V21H8v-1.5z"
          fill="white"
        />
      </svg>
      <span
        style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 700,
          fontSize: "16px",
          color: "var(--text-primary)",
          letterSpacing: "-0.03em",
        }}
      >
        Sila Layer
      </span>
    </div>
  );
}

interface NavbarProps {
  transparent?: boolean;
}

export function Navbar({ transparent = false }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { login, authenticated } = usePrivy();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backgroundColor: transparent ? "transparent" : "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: transparent ? "none" : "1px solid var(--border)",
        padding: "0 32px",
        height: "60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {/* Left: Logo */}
      <Link href="/" style={{ textDecoration: "none" }}>
        <SilaLogo />
      </Link>

      {/* Center: Nav links */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        {[
          { label: "How it works", href: "/#how-it-works" },
          { label: "Docs", href: "/docs" },
          { label: "Compliance", href: "/#compliance" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--ash)",
              textDecoration: "none",
              padding: "6px 14px",
              borderRadius: "var(--radius-pill)",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.color = "var(--text-primary)";
              (e.target as HTMLElement).style.backgroundColor = "var(--surface-alt)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.color = "var(--ash)";
              (e.target as HTMLElement).style.backgroundColor = "transparent";
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Right: CTAs */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <a
          href="mailto:hello@silalayer.xyz"
          className="btn btn-ghost"
          style={{ fontSize: "14px", padding: "8px 14px" }}
        >
          Talk to us
        </a>
        <Link
          href="/docs"
          className="btn btn-outline"
          style={{ fontSize: "14px", padding: "8px 16px" }}
        >
          Docs
        </Link>
        {authenticated ? (
          <Link
            href="/dashboard"
            className="btn btn-primary"
            style={{ fontSize: "14px", padding: "8px 18px", border: "none", cursor: "pointer", textDecoration: "none" }}
          >
            Dashboard →
          </Link>
        ) : (
          <button
            onClick={login}
            id="nav-cta-signin"
            className="btn btn-primary"
            style={{ fontSize: "14px", padding: "8px 18px", border: "none", cursor: "pointer" }}
          >
            Merchant sign-in →
          </button>
        )}
      </div>
    </header>
  );
}
