import type { Metadata, Viewport } from "next";
import { Oxanium } from "next/font/google";
import { site } from "@/lib/content";
import "./globals.css";

const display = Oxanium({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: `${site.name} — Quantum-grade web, maintenance & AI engineering`,
  description: site.description,
  openGraph: { title: `${site.name} — Quantum-grade digital engineering`, description: site.description, type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#020506", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={display.variable}>
      <head>
        <link rel="preload" href="/fonts/oxanium-500.woff" as="font" type="font/woff" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
