"use client";

import React from "react";
import { formatUnits } from "viem";
import { CONTRACTS } from "@/lib/contracts";
import { RailBadge, railFromAddress } from "@/components/ui/RailBadge";

export interface SettlementRow {
  txHash: `0x${string}`;
  blockNumber: bigint;
  timestamp: number;
  merchant: `0x${string}`;
  rail: `0x${string}`;
  payerAsset?: `0x${string}`;
  amountIn?: bigint;
  amountOut: bigint;
  purpose: number;
  reason: string;
  /** True if this row represents a failed/rejected settlement */
  failed?: boolean;
}

interface SettlementsLedgerProps {
  rows: SettlementRow[];
  loading: boolean;
  error: string;
}

const PURPOSE_LABELS: Record<number, string> = {
  0: "RetailGoods",
  1: "VirtualAssetRelated",
  2: "CrossBorderB2B",
};

function formatAmount(rail: `0x${string}`, amount: bigint): string {
  if (rail.toLowerCase() === CONTRACTS.usdc.toLowerCase()) {
    return `${formatUnits(amount, 6)} USDC`;
  }
  if (rail.toLowerCase() === CONTRACTS.aedpt.toLowerCase()) {
    return `${formatUnits(amount, 2)} AED-PT`;
  }
  return amount.toString();
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleString("en-AE", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function truncateHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function SettledIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="6.5" stroke="var(--dirham-teal)" strokeWidth="1.2" />
      <path d="M4.5 7.5l2 2 4-4" stroke="var(--dirham-teal)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RejectedIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 1.5L13.5 12.5H1.5L7.5 1.5Z" stroke="var(--rust)" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M7.5 6v3" stroke="var(--rust)" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="7.5" cy="10.5" r="0.6" fill="var(--rust)" />
    </svg>
  );
}

function EmptyState() {
  return (
    <tr>
      <td colSpan={6}>
        <div style={{ padding: "48px 24px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-plex-sans)", color: "var(--ash)", fontSize: "13px" }}>
            No settlements yet. Events will appear here as they are emitted by the SettlementRouter contract.
          </p>
        </div>
      </td>
    </tr>
  );
}

function LoadingRows() {
  return (
    <>
      {[...Array(4)].map((_, i) => (
        <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
          {[...Array(6)].map((_, j) => (
            <td key={j} style={{ padding: "14px 16px" }}>
              <div
                style={{
                  height: "12px",
                  width: j === 4 ? "60px" : j === 5 ? "180px" : "80px",
                  backgroundColor: "var(--border)",
                  borderRadius: "2px",
                  animation: "pulse 1.5s ease-in-out infinite",
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </>
  );
}

export function SettlementsLedger({ rows, loading, error }: SettlementsLedgerProps) {
  const thStyle: React.CSSProperties = {
    fontFamily: "var(--font-plex-sans)",
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--ash)",
    padding: "10px 16px",
    textAlign: "left",
    borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap",
    backgroundColor: "var(--paper)",
  };

  if (error) {
    return (
      <div
        style={{
          border: "1px solid var(--rust)",
          borderLeft: "3px solid var(--rust)",
          backgroundColor: "#FDF3EF",
          padding: "16px 20px",
        }}
      >
        <p style={{ fontFamily: "var(--font-plex-sans)", color: "var(--rust)", fontWeight: 500, margin: 0 }}>
          Could not load settlement events
        </p>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--ash)", margin: "4px 0 0" }}>
          {error}
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "var(--paper)",
        border: "1px solid var(--border-paper)",
        overflowX: "auto",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "13px",
        }}
      >
        <thead>
          <tr>
            <th style={{ ...thStyle, width: "32px", paddingRight: "0" }}></th>
            <th style={thStyle}>Time</th>
            <th style={thStyle}>Reference</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Amount Out</th>
            <th style={thStyle}>Rail</th>
            <th style={thStyle}>Reason</th>
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0 ? (
            <LoadingRows />
          ) : rows.length === 0 ? (
            <EmptyState />
          ) : (
            rows.map((row, i) => {
              const rail = railFromAddress(row.rail, CONTRACTS.usdc, CONTRACTS.aedpt);
              const isRejected = row.failed === true;

              const rowStyle: React.CSSProperties = {
                borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none",
                borderLeft: isRejected ? "3px solid var(--rust)" : "3px solid transparent",
                backgroundColor: isRejected ? "#FDF3EF" : "transparent",
                transition: "background-color 0.1s",
              };

              const cellStyle: React.CSSProperties = {
                padding: "13px 16px",
                verticalAlign: "middle",
                color: isRejected ? "var(--rust)" : "var(--ink)",
              };

              return (
                <tr
                  key={`${row.txHash}-${i}`}
                  style={rowStyle}
                  onMouseEnter={(e) => {
                    if (!isRejected) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--limestone)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isRejected) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                    else (e.currentTarget as HTMLElement).style.backgroundColor = "#FDF3EF";
                  }}
                >
                  {/* Status icon */}
                  <td style={{ ...cellStyle, paddingLeft: "16px", paddingRight: "4px", width: "32px" }}>
                    {isRejected ? <RejectedIcon /> : <SettledIcon />}
                  </td>

                  {/* Time */}
                  <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                    <span
                      className="font-mono"
                      style={{ fontSize: "12px", color: isRejected ? "var(--rust)" : "var(--ash)" }}
                    >
                      {formatDate(row.timestamp)}
                    </span>
                  </td>

                  {/* Reference (tx hash) */}
                  <td style={cellStyle}>
                    <a
                      href={`https://amoy.polygonscan.com/tx/${row.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono"
                      style={{
                        fontSize: "12px",
                        color: "var(--dirham-teal)",
                        textDecoration: "none",
                      }}
                      title={row.txHash}
                    >
                      {truncateHash(row.txHash)}
                    </a>
                    <span
                      style={{
                        display: "block",
                        fontSize: "11px",
                        color: "var(--ash)",
                        marginTop: "2px",
                        fontFamily: "var(--font-plex-sans)",
                      }}
                    >
                      {PURPOSE_LABELS[row.purpose] ?? `Purpose ${row.purpose}`}
                    </span>
                  </td>

                  {/* Amount */}
                  <td style={{ ...cellStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                    <span
                      className="font-mono"
                      style={{
                        fontWeight: 500,
                        fontSize: "13px",
                        color: isRejected ? "var(--rust)" : "var(--ink)",
                      }}
                    >
                      {formatAmount(row.rail, row.amountOut)}
                    </span>
                    {row.amountIn !== undefined && row.payerAsset && row.payerAsset !== row.rail && (
                      <span
                        className="font-mono"
                        style={{
                          display: "block",
                          fontSize: "11px",
                          color: "var(--ash)",
                        }}
                      >
                        ← {formatAmount(row.payerAsset, row.amountIn)}
                      </span>
                    )}
                  </td>

                  {/* Rail badge */}
                  <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                    {isRejected ? (
                      <span
                        style={{
                          fontFamily: "var(--font-plex-sans)",
                          fontSize: "11px",
                          fontWeight: 500,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          color: "var(--rust)",
                          padding: "2px 7px",
                          border: "1px solid var(--rust)",
                          borderRadius: "3px",
                          display: "inline-block",
                        }}
                      >
                        Rejected
                      </span>
                    ) : (
                      <RailBadge rail={rail} />
                    )}
                  </td>

                  {/* Reason string — verbatim from contract event */}
                  <td
                    style={{
                      ...cellStyle,
                      maxWidth: "340px",
                      fontFamily: "var(--font-plex-sans)",
                      fontSize: "12px",
                      color: isRejected ? "var(--rust)" : "var(--ash)",
                    }}
                  >
                    {row.reason}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
