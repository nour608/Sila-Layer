"use client";

import dynamic from "next/dynamic";
import { type ReactNode } from "react";

// The Privy SDK assumes a browser context (window, localStorage). Loading it during SSR
// causes hydration / `window is not defined` errors. Import the real provider with
// ssr: false so it only renders in the browser.
const ClientPrivyProvider = dynamic(
  () => import("./ClientPrivyProvider").then((mod) => mod.ClientPrivyProvider),
  { ssr: false },
);

export default function DynamicPrivyProvider({
  children,
}: {
  children: ReactNode;
}) {
  return <ClientPrivyProvider>{children}</ClientPrivyProvider>;
}
