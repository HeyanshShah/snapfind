// app/layout.tsx
// The frame that wraps every page: the page title, phone settings, and our styles.
import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./themes.css";
// Free usage tracking from Vercel (where the app will live). It counts visits and the events
// we send with track(), without cookies or personal info. It only turns on once deployed.
import { Analytics } from "@vercel/analytics/next";
// Fonts: next/font downloads them once at build time and serves them from our own site,
// so visitors' browsers never have to ask Google for them.
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";

const sans = Space_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "SnapFind",
  description: "Point your camera at anything and find out what it is and where to buy it.",
  // Makes "Add to Home Screen" on iPhones open SnapFind full screen, like a real app.
  appleWebApp: { capable: true, title: "SnapFind", statusBarStyle: "black-translucent" },
};

// Makes the app fit phone screens properly instead of looking zoomed out.
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#05060f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="aurora" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
