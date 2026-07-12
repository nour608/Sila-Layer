import type { Metadata } from "next";
import { LoginPage } from "@/components/login/LoginPage";

export const metadata: Metadata = {
  title: "Sign in — Sila Layer",
  description: "Merchant sign-in for the Sila Layer settlement dashboard.",
};

export default function LoginRoute() {
  return <LoginPage />;
}
