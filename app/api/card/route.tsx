// app/api/card/route.tsx
// Makes a shareable picture (a "share card") like: "Found these for $180 at Nike".
// It's sized 1080x1350, the shape Instagram and TikTok like for posts.
//
// The cool trick: we describe the picture with the same HTML-style code we use for the page,
// and Next.js's ImageResponse turns it into a real PNG image.

import { ImageResponse } from "next/og";

// Keeps text from getting too long for the card.
function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const name = clip(p.get("name") ?? "Something cool", 70);
  const price = clip(p.get("price") ?? "", 12); // e.g. "$180"
  const store = clip(p.get("store") ?? "", 40); // e.g. "Nike"
  const save = clip(p.get("save") ?? "", 12); // e.g. "$74"

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", padding: 90, color: "white",
          background: "linear-gradient(160deg, #0b0b0f 0%, #241b5c 100%)", fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 44, color: "#b9a8ff", fontWeight: 700 }}>SnapFind</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 40, color: "#9a9aa8" }}>I snapped a photo and found</div>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.1, marginTop: 16 }}>{name}</div>
          {price && (
            <div style={{ display: "flex", alignItems: "baseline", marginTop: 48 }}>
              <div style={{ fontSize: 150, fontWeight: 800 }}>{price}</div>
              {store && <div style={{ fontSize: 44, color: "#9a9aa8", marginLeft: 24 }}>{`at ${store}`}</div>}
            </div>
          )}
          {save && <div style={{ fontSize: 48, color: "#7cf5b0", marginTop: 12 }}>{`Saved ${save} vs. other stores`}</div>}
        </div>
        <div style={{ fontSize: 36, color: "#9a9aa8" }}>Point. Snap. Find it cheaper.</div>
      </div>
    ),
    { width: 1080, height: 1350 },
  );
}
