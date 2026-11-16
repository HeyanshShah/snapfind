// app/page.tsx
// This is the screen people see. "use client" means this code runs on the user's phone
// (in their browser), so it can open the camera and react when they tap buttons.
"use client";

import { useState } from "react";
import type { Item } from "@/lib/identify";
import type { ShopLink } from "@/lib/shopLinks";
import type { PriceReport } from "@/lib/prices/index";
import type { Offer } from "@/lib/prices/types";

type Result = { item: Item; links: ShopLink[] };

// Shows money nicely: 159.5 -> "$159.50", 160 -> "$160".
function money(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

// One deal box: "Best new deal: $160 at Nike, free shipping".
function DealCard({ label, offer }: { label: string; offer: Offer }) {
  return (
    <a className="deal" href={offer.url} target="_blank" rel="noopener noreferrer">
      <span className="deal-label">{label}</span>
      <span className="deal-price">{money(offer.total)}</span>
      <span className="deal-store">
        {offer.store}
        {offer.shipping === 0 ? " · free shipping" : offer.shipping ? ` · incl. ${money(offer.shipping)} shipping` : " · shipping not listed"}
      </span>
    </a>
  );
}

// Phone photos are huge (often 4000+ pixels wide). We shrink them to 1024 pixels before
// sending. That makes uploads way faster, and the AI can still see plenty of detail.
async function shrinkPhoto(file: File, maxSize = 1024): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas"); // an invisible drawing board
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read photo"))), "image/jpeg", 0.85),
  );
}

export default function Home() {
  // "State" is the app's memory. When it changes, the screen redraws by itself.
  const [preview, setPreview] = useState<string | null>(null); // the photo to show
  const [loading, setLoading] = useState(false); // are we waiting for the AI?
  const [result, setResult] = useState<Result | null>(null); // the AI's answer
  const [error, setError] = useState<string | null>(null); // any problem to show
  const [prices, setPrices] = useState<PriceReport | null>(null); // live prices from stores
  const [pricesLoading, setPricesLoading] = useState(false);

  // Step 2, after we know WHAT the item is: ask our server to check prices at every store.
  async function loadPrices(query: string) {
    setPricesLoading(true);
    try {
      const res = await fetch(`/api/prices?q=${encodeURIComponent(query)}`);
      if (res.ok) setPrices(await res.json());
    } finally {
      setPricesLoading(false);
    }
  }

  // Runs when the user picks or takes a photo.
  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setResult(null);
    setError(null);
    setPrices(null);
    setPreview(URL.createObjectURL(file));
    setLoading(true);

    try {
      const small = await shrinkPhoto(file);
      const body = new FormData(); // a package to mail to our server
      body.append("photo", small, "photo.jpg");

      const res = await fetch("/api/identify", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setResult(data);
      // Show the item right away, then fetch prices in the background (no "await" here).
      if (data.item.found) loadPrices(data.item.searchQuery);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false); // stop the spinner no matter what happened
      e.target.value = ""; // lets the user pick the same photo again
    }
  }

  const item = result?.item;

  return (
    <main className="wrap">
      <h1 className="logo">SnapFind</h1>
      <p className="tagline">Point. Snap. Find out what it is and where to get it.</p>

      {/* capture="environment" opens the back camera on phones. On a laptop it opens a file picker. */}
      <label className="snap">
        {loading ? "Looking..." : preview ? "Snap another" : "Snap something"}
        <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} disabled={loading} hidden />
      </label>

      {preview && <img className="preview" src={preview} alt="Your photo" />}

      {loading && <div className="spinner" aria-label="Loading" />}

      {error && <p className="error">{error}</p>}

      {result && !item?.found && (
        <p className="error">Couldn&apos;t spot anything to buy in that photo. Try getting closer to the item.</p>
      )}

      {item?.found && (
        <section className="card">
          <p className="category">
            {item.category} · {item.confidence} confidence
          </p>
          <h2>{item.name}</h2>
          <p className="desc">{item.description}</p>
          {item.priceHigh > 0 && (
            <p className="price">
              ${item.priceLow.toLocaleString()}
              {item.priceHigh !== item.priceLow && <> – ${item.priceHigh.toLocaleString()}</>}
              <span className="est"> typical price</span>
            </p>
          )}

          {pricesLoading && <p className="muted">Checking prices at every store...</p>}

          {prices?.bestNew && <DealCard label="Best new deal" offer={prices.bestNew} />}
          {prices?.bestUsed && <DealCard label="Best used deal" offer={prices.bestUsed} />}
          {prices?.savings ? (
            <p className="muted">Saves you {money(prices.savings)} vs. the priciest store we found.</p>
          ) : null}

          {prices && prices.offers.length > 0 && (
            <details className="offers">
              <summary>All {prices.offers.length} offers from {prices.sourcesUsed.join(" + ")}</summary>
              <ul>
                {prices.offers.slice(0, 15).map((o, i) => (
                  <li key={i}>
                    <a href={o.url} target="_blank" rel="noopener noreferrer">
                      <span>
                        {o.store}
                        {o.condition === "used" && <em> · used</em>}
                        {!o.trusted && <em> · unverified seller</em>}
                      </span>
                      <strong>{money(o.total)}</strong>
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {prices?.configured && prices.offers.length === 0 && !pricesLoading && (
            <p className="muted">No live prices found. Try the store links below.</p>
          )}

          <div className="links">
            {result!.links.map((l) => (
              <a key={l.store} href={l.url} target="_blank" rel="noopener noreferrer">
                {l.store} →
              </a>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
