// app/page.tsx
// This is the screen people see. "use client" means this code runs on the user's phone
// (in their browser), so it can open the camera and react when they tap buttons.
"use client";

import { useEffect, useState } from "react";
import { track } from "@vercel/analytics";
import type { Item } from "@/lib/identify";
import type { ShopLink } from "@/lib/shopLinks";
import type { PriceReport } from "@/lib/prices/index";
import type { Offer } from "@/lib/prices/types";

type Result = { item: Item; links: ShopLink[]; cached?: boolean; demo?: boolean; affiliate?: boolean };

// One saved snap in your history.
type Snap = { id: string; at: number; thumb: string; result: Result; prices: PriceReport | null };

// History is saved in the phone's own browser storage ("localStorage"), so it needs no
// account and no server. It's like a notebook that stays in your browser.
const HISTORY_KEY = "snapfind-history";
const HISTORY_MAX = 20;

function loadHistory(): Snap[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return []; // private browsing or a broken notebook: just start empty
  }
}

function saveHistory(snaps: Snap[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(snaps.slice(0, HISTORY_MAX)));
  } catch {
    // Storage full or blocked. History is a nice extra, so the app keeps working without it.
  }
}

// Turns a picture into a "data URL": the whole image written as text, so it can be saved.
function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

// Shows money nicely: 159.5 -> "$159.50", 160 -> "$160".
function money(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

// One deal box: "Best new deal: $160 at Nike, free shipping".
function DealCard({ label, offer }: { label: string; offer: Offer }) {
  return (
    <a
      className="deal"
      href={offer.url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() => track("deal_click", { store: offer.store, total: offer.total })}
    >
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
  const [history, setHistory] = useState<Snap[]>([]);

  // useEffect with [] runs once, right after the page first appears: open the notebook.
  useEffect(() => setHistory(loadHistory()), []);

  // Adds or updates one snap in the history (newest first), on screen and in storage.
  function remember(snap: Snap) {
    setHistory((old) => {
      const next = [snap, ...old.filter((s) => s.id !== snap.id)].slice(0, HISTORY_MAX);
      saveHistory(next);
      return next;
    });
  }

  // Step 2, after we know WHAT the item is: ask our server to check prices at every store.
  async function loadPrices(query: string, snap: Snap) {
    setPricesLoading(true);
    try {
      const res = await fetch(`/api/prices?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const report: PriceReport = await res.json();
        setPrices(report);
        remember({ ...snap, prices: report }); // save the prices with the snap
      }
    } finally {
      setPricesLoading(false);
    }
  }

  // Re-opens an old snap from history, no AI or price check needed.
  function openSnap(snap: Snap) {
    setPreview(snap.thumb);
    setResult(snap.result);
    setPrices(snap.prices);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Share button: make the share card picture, then open the phone's share sheet
  // (Instagram, TikTok, Messages...). Computers without a share sheet download it instead.
  async function share() {
    if (!result) return;
    const best = prices?.bestNew ?? prices?.bestUsed;
    const params = new URLSearchParams({ name: result.item.name });
    if (best) {
      params.set("price", money(best.total));
      params.set("store", best.store);
    }
    if (prices?.savings) params.set("save", money(prices.savings));

    const blob = await (await fetch(`/api/card?${params}`)).blob();
    const file = new File([blob], "snapfind.png", { type: "image/png" });
    track("share", { item: result.item.name });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "SnapFind" }).catch(() => {}); // cancel = fine
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "snapfind.png";
      a.click();
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
      // Usage tracking: count snaps, and whether the AI found something.
      track("snap", { found: data.item.found, cached: Boolean(data.cached), category: data.item.category || "none" });
      if (data.item.found) {
        // Save it to history with a tiny 160px thumbnail (big photos would fill up storage).
        const snap: Snap = { id: crypto.randomUUID(), at: Date.now(), thumb: await toDataUrl(await shrinkPhoto(file, 160)), result: data, prices: null };
        remember(snap);
        // Show the item right away, then fetch prices in the background (no "await" here).
        loadPrices(data.item.searchQuery, snap);
      }
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

      {result?.demo && (
        <p className="demo-banner">Demo mode: showing a sample result. Real recognition turns on once the AI key is added.</p>
      )}

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
            {result?.cached && <span className="instant"> · ⚡ instant</span>}
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
                    <a
                      href={o.url}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      onClick={() => track("offer_click", { store: o.store, total: o.total })}
                    >
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
              <a
                key={l.store}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={() => track("store_link_click", { store: l.store })}
              >
                {l.store} →
              </a>
            ))}
          </div>

          <button className="share" onClick={share} disabled={pricesLoading}>
            Share this find
          </button>
          {/* US law (the FTC) says you must tell people when links can earn you money. */}
          {result?.affiliate && <p className="disclosure">SnapFind may earn a commission from purchases through these links.</p>}
        </section>
      )}

      {history.length > 0 && (
        <section className="history">
          <h3>Your recent snaps</h3>
          <div className="history-grid">
            {history.map((snap) => {
              const best = snap.prices?.bestNew ?? snap.prices?.bestUsed;
              return (
                <button key={snap.id} className="history-item" onClick={() => openSnap(snap)}>
                  <img src={snap.thumb} alt="" />
                  <span className="history-name">{snap.result.item.name}</span>
                  {best && <span className="history-price">{money(best.total)}</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
