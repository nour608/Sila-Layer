import React from "react";

interface MetricCardProps {
  label: string;
  value: string;
  /** Optional sub-label below the value, e.g. "today" or token symbol */
  sublabel?: string;
  /** If true, shows a loading shimmer instead of value */
  loading?: boolean;
}

export function MetricCard({ label, value, sublabel, loading }: MetricCardProps) {
  return (
    <div
      style={{
        backgroundColor: "var(--paper)",
        border: "1px solid var(--border-paper)",
        padding: "20px 24px",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-plex-sans)",
          fontSize: "11px",
          fontWeight: 500,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--ash)",
          margin: 0,
        }}
      >
        {label}
      </p>

      {loading ? (
        <div
          style={{
            marginTop: "10px",
            height: "32px",
            width: "120px",
            backgroundColor: "var(--border)",
            borderRadius: "2px",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      ) : (
        <p
          className="font-mono"
          style={{
            fontSize: "28px",
            fontWeight: 500,
            color: "var(--ink)",
            margin: "10px 0 0",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          {value}
        </p>
      )}

      {sublabel && !loading && (
        <p
          style={{
            fontFamily: "var(--font-plex-sans)",
            fontSize: "12px",
            color: "var(--ash)",
            margin: "4px 0 0",
          }}
        >
          {sublabel}
        </p>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}
