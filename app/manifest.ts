// app/manifest.ts
// The "manifest" is the app's ID card. It tells the phone: my name, my icon, my colors,
// and "open me full screen like a real app." With it, people can tap "Add to Home Screen"
// (or "Install app") and SnapFind gets its own icon, no app store needed.
// An app like this is called a PWA: a Progressive Web App.
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SnapFind",
    short_name: "SnapFind",
    description: "Point your camera at anything and find the best place to buy it.",
    start_url: "/",
    display: "standalone", // full screen, no browser address bar
    background_color: "#0b0b0f",
    theme_color: "#0b0b0f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
