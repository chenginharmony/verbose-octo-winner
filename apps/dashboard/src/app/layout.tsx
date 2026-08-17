import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Base MEV Research Terminal | Empirical Observation Platform",
  description: "Research-first MEV telemetry and simulation engine built on Degenbot primitives on Base Mainnet",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-[#080a0f] text-[#f0f3f8]">
        {children}
      </body>
    </html>
  );
}
