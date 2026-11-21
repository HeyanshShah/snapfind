// app/layout.tsx
// The frame that wraps every page: the page title, phone settings, and our styles.
import type { Metadata, Viewport } from "next";
import "./globals.css";
// Free usage tracking from Vercel (where the app will live). It counts visits and the events
// we send with track(), without cookies or personal info. It only turns on once deployed.
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "SnapFind",
  description: "Point your camera at anything and find out what it is and where to buy it.",
  // Makes "Add to Home Screen" on iPhones open SnapFind full screen, like a real app.
  appleWebApp: { capable: true, title: "SnapFind", statusBarStyle: "black-translucent" },
};

// Makes the app fit phone screens properly instead of looking zoomed out.
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#08080c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
