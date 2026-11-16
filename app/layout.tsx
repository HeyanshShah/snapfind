// app/layout.tsx
// The frame that wraps every page: the page title, phone settings, and our styles.
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SnapFind",
  description: "Point your camera at anything and find out what it is and where to buy it.",
};

// Makes the app fit phone screens properly instead of looking zoomed out.
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
