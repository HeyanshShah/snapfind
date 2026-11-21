// app/ui.tsx
// Small building blocks for the screen: icons, store badges, and number helpers.
// Keeping them here makes page.tsx shorter and easier to read.

// Shows money nicely: 159.5 -> "$159.50", 160 -> "$160".
export function money(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

// "3 min ago", "2 h ago", "4 d ago": how long ago something happened.
export function ago(at: number): string {
  const min = Math.round((Date.now() - at) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  if (min < 60 * 24) return `${Math.round(min / 60)} h ago`;
  return `${Math.round(min / 60 / 24)} d ago`;
}

// Icons are drawn with SVG: tiny pictures described as lines and shapes, written as code.
// No image files to download, and they stay sharp at any size.
const PATHS = {
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.35-4.35",
  camera: "M3 8.5A2.5 2.5 0 0 1 5.5 6h1.6l1.5-2h6.8l1.5 2h1.6A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5zM12 9.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z",
  arrow: "M5 12h14M13 6l6 6-6 6",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  share: "M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  tag: "M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM7.5 7.5h.01",
  back: "M19 12H5M11 6l-6 6 6 6",
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
} as const;

export function Icon({ name, size = 20 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

// A round badge with the store's first letter, in a color picked from the store's name.
// The same store always gets the same color, so you start to recognize them.
export function StoreBadge({ store, size = 36 }: { store: string; size?: number }) {
  let hash = 0;
  for (const ch of store) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span className="badge" style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${hash} 70% 45% / 0.22)`, color: `hsl(${hash} 90% 75%)` }}>
      {store.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}
