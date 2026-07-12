"use client";

import Link from "next/link";
import { InteractiveDotsCanvas } from "./InteractiveDotsCanvas";
import { usePrivy } from "@privy-io/react-auth";

export function HeroSection() {
  const { login, authenticated } = usePrivy();
  return (
    <section
      style={{
        position: "relative",
        minHeight: "calc(100vh - 60px)",
        backgroundColor: "#fff",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
      }}
    >
      {/* Full-bleed interactive dots canvas */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
        }}
      >
        <InteractiveDotsCanvas
          dotCount={1500}
          mouseRepelRadius={90}
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      {/* Content overlay */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "80px 48px 100px",
          width: "100%",
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "rgba(15,107,92,0.08)",
            border: "1px solid rgba(15,107,92,0.2)",
            borderRadius: "var(--radius-pill)",
            padding: "5px 14px",
            marginBottom: "32px",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "var(--dirham-teal)",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "12px",
              fontWeight: 500,
              color: "var(--dirham-teal)",
              letterSpacing: "0.02em",
            }}
          >
            Polygon Amoy Testnet · PTSR-aware routing
          </span>
        </div>

        {/* Headline — bold, large, dark, Minds.ai style */}
        <h1
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "clamp(42px, 6.5vw, 82px)",
            fontWeight: 900,
            color: "var(--text-primary)",
            margin: "0 0 28px",
            lineHeight: "1.04",
            letterSpacing: "-0.04em",
            maxWidth: "780px",
          }}
        >
          Compliant stablecoin settlement.
          <br />
          <span style={{ color: "var(--dirham-teal)" }}>UAE-native</span> &amp; regulatory-ready.
        </h1>

        {/* Body copy */}
        <p
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "17px",
            fontWeight: 400,
            color: "var(--ash)",
            margin: "0 0 48px",
            maxWidth: "540px",
            lineHeight: "1.7",
          }}
        >
          Each payment is automatically routed to the rail your regulatory zone
          actually allows — AED-PT for mainland retail, USDC where PTSR permits.
          The merchant never has to understand the regulation to be compliant with it.
        </p>

        {/* CTA row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          {authenticated ? (
            <Link
              href="/dashboard"
              className="btn btn-primary"
              style={{ fontSize: "15px", padding: "12px 26px", border: "none", cursor: "pointer", textDecoration: "none" }}
            >
              Dashboard →
            </Link>
          ) : (
            <button
              onClick={login}
              id="hero-cta-signin"
              className="btn btn-primary"
              style={{ fontSize: "15px", padding: "12px 26px", border: "none", cursor: "pointer" }}
            >
              Merchant sign-in →
            </button>
          )}
          <Link
            href="/docs"
            id="hero-cta-docs"
            className="btn btn-outline"
            style={{ fontSize: "15px", padding: "12px 22px" }}
          >
            Read the docs
          </Link>
          <a
            href="mailto:hello@silalayer.xyz"
            id="hero-cta-talk"
            className="btn btn-ghost"
            style={{ fontSize: "15px" }}
          >
            Talk to us
          </a>
        </div>

        {/* Social proof / trust */}
        <div
          style={{
            marginTop: "64px",
            display: "flex",
            alignItems: "center",
            gap: "24px",
            flexWrap: "wrap",
          }}
        >
          {[
            { label: "PTSR-Compliant", desc: "Routing" },
            { label: "Polygon Amoy", desc: "Testnet" },
            { label: "DIFC / Mainland", desc: "Zone-aware" },
            { label: "Open Source", desc: "Contracts" },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "var(--dirham-teal)",
                  flexShrink: 0,
                  opacity: 0.7,
                }}
              />
              <span
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                {item.label}
              </span>
              <span
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "13px",
                  color: "var(--text-subtle)",
                }}
              >
                {item.desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
