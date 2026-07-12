import React from "react";

type Rail = "aedpt" | "usdc" | "unknown";

interface RailBadgeProps {
  rail: Rail;
}

const RAIL_CONFIG: Record<
  Rail,
  { label: string; bg: string; text: string }
> = {
  aedpt: {
    label: "AED-PT",
    bg: "var(--dirham-teal)",
    text: "#fff",
  },
  usdc: {
    label: "USDC",
    bg: "var(--usdc-navy)",
    text: "#fff",
  },
  unknown: {
    label: "Unknown",
    bg: "var(--ash)",
    text: "#fff",
  },
};

export function RailBadge({ rail }: RailBadgeProps) {
  const cfg = RAIL_CONFIG[rail];
  return (
    <span
      style={{
        backgroundColor: cfg.bg,
        color: cfg.text,
        fontFamily: "var(--font-plex-sans)",
        fontSize: "11px",
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        padding: "2px 7px",
        borderRadius: "3px",
        display: "inline-block",
        lineHeight: "1.6",
        whiteSpace: "nowrap",
      }}
    >
      {cfg.label}
    </span>
  );
}

/** Derive a Rail discriminant from a contract address. */
export function railFromAddress(
  address: `0x${string}`,
  usdcAddress: `0x${string}`,
  aedptAddress: `0x${string}`,
): Rail {
  const addr = address.toLowerCase();
  if (addr === usdcAddress.toLowerCase()) return "usdc";
  if (addr === aedptAddress.toLowerCase()) return "aedpt";
  return "unknown";
}
