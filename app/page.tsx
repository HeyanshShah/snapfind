// app/page.tsx
// This is the screen people see. "use client" means this code runs on the user's phone
// (in their browser), so it can open the camera and react when they tap buttons.
"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, StoreBadge, money, ago } from "./ui";
import { Scramble, useTypingHint, CountUp, useTilt, useSpotlight, ScanLog, Viewfinder } from "./fx";
import { track } from "@vercel/analytics";
import type { Item } from "@/lib/identify";
import type { ShopLink } from "@/lib/shopLinks";
import type { PriceReport } from "@/lib/prices/index";
import type { Offer } from "@/lib/prices/types";
import { newWatch, updateWatch, needsCheck, dropAmount, sameItem, WATCH_MAX, type Watch } from "@/lib/watch";

type Result = { item: Item; links: ShopLink[]; cached?: boolean; demo?: boolean; affiliate?: boolean; typed?: boolean };
type PricesResponse = PriceReport & { links: ShopLink[]; affiliate: boolean };

// One saved snap in your history.
type Snap = { id: string; at: number; thumb: string; result: Result; prices: PriceReport | null };

// History is saved in the phone's own browser storage ("localStorage"), so it needs no
// account and no server. It's like a notebook that stays in your browser.
const HISTORY_KEY = "snapfind-history";
const HISTORY_MAX = 20;

// The watch list lives in browser storage too, in its own notebook.
const WATCH_KEY = "snapfind-watch";
function loadWatches(): Watch[] {
  try {
    return JSON.parse(localStorage.getItem(WATCH_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function saveWatches(list: Watch[]) {
  try {
    localStorage.setItem(WATCH_KEY, JSON.stringify(list));
  } catch {}
}

// Asks our server for today's prices. Returns null if anything goes wrong.
async function fetchPrices(query: string, category: string, demo: boolean): Promise<PriceReport | null> {
  const params = new URLSearchParams({ q: query, category });
  if (demo) params.set("demo", "1");
  try {
    const res = await fetch(`/api/prices?${params}`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

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

// Product ideas the search box "types" by itself on the home screen.
const HINTS = ["AirPods Pro 2", "Jordan 1 Chicago", "PS5 Slim", "Stanley Quencher", "Dyson Airwrap", "Nintendo Switch 2"];

// One best-deal card. It tilts toward your mouse, and the price rolls up when it appears.
function DealCard({ label, offer, top, shipping }: { label: string; offer: Offer; top: boolean; shipping: string }) {
  const ref = useTilt<HTMLAnchorElement>();
  return (
    <a ref={ref} className={top ? "deal spot top" : "deal spot"} href={offer.url} target="_blank" rel="noopener noreferrer sponsored"
      onClick={() => track("deal_click", { store: offer.store, total: offer.total })}>
      <span className="deal-label mono"><Icon name="tag" size={14} /> {label}</span>
      <span className="deal-price mono"><CountUp value={offer.total} format={money} /></span>
      <span className="deal-store"><StoreBadge store={offer.store} size={24} /> {offer.store} · {shipping}</span>
      <span className="deal-cta">Go to store <Icon name="external" size={15} /></span>
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
  const [showAll, setShowAll] = useState(false); // show every offer, or just the top few?
  const [thumb, setThumb] = useState(""); // tiny photo of what's on screen (for the watch list)
  const [watches, setWatches] = useState<Watch[]>([]);
  const [drops, setDrops] = useState<Watch[]>([]); // items that got cheaper since last visit
  const checkedOnce = useRef(false); // so we only re-check the watch list once per visit
  const searchRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false); // is a photo being dragged over the page?
  useSpotlight();

  // Keyboard shortcut: press "/" or Ctrl/Cmd+K anywhere to jump into the search box.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === "INPUT";
      if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  // useEffect with [] runs once, right after the page first appears: open the notebook.
  useEffect(() => setHistory(loadHistory()), []);

  // Open the watch list, then quietly re-check prices for anything not checked in 6 hours.
  useEffect(() => {
    const list = loadWatches();
    setWatches(list);
    if (checkedOnce.current) return;
    checkedOnce.current = true;
    (async () => {
      const found: Watch[] = [];
      // One at a time (not all at once), to go easy on the price sources.
      for (const w of list.filter((w) => needsCheck(w, Date.now()))) {
        const report = await fetchPrices(w.query, w.category, w.demo);
        if (!report) continue;
        const before = w.price;
        const fresh = updateWatch(w, report, Date.now());
        changeWatches((all) => all.map((x) => (x.id === w.id ? fresh : x)));
        if (before !== null && fresh.price !== null && fresh.price < before) found.push(fresh);
      }
      if (found.length) {
        setDrops(found);
        track("price_drop_seen", { count: found.length });
      }
    })();
  }, []);

  // Changes the watch list, on screen and in storage.
  function changeWatches(fn: (old: Watch[]) => Watch[]) {
    setWatches((old) => {
      const next = fn(old);
      saveWatches(next);
      return next;
    });
  }

  // The "Watch price" button: start watching what's on screen, or stop if already watching.
  function toggleWatch() {
    if (!result) return;
    const item = result.item;
    if (watches.some((w) => sameItem(w, item.searchQuery))) {
      changeWatches((all) => all.filter((w) => !sameItem(w, item.searchQuery)));
      track("watch_remove");
      return;
    }
    const w = newWatch(item, prices, { id: crypto.randomUUID(), thumb, demo: Boolean(result.demo), now: Date.now() });
    changeWatches((all) => [w, ...all].slice(0, WATCH_MAX));
    track("watch_add", { item: item.name });
  }

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
      const params = new URLSearchParams({ q: query, category: snap.result.item.category });
      if (snap.result.demo) params.set("demo", "1");
      const res = await fetch(`/api/prices?${params}`);
      if (res.ok) {
        const report: PricesResponse = await res.json();
        setPrices(report);
        // A typed search has no store links yet, so it takes the ones that came with the prices.
        const result = snap.result.typed ? { ...snap.result, links: report.links, affiliate: report.affiliate } : snap.result;
        if (snap.result.typed) setResult(result);
        remember({ ...snap, result, prices: report }); // save the prices with the snap
        // Watching this item? These are fresh prices, so update the watch for free.
        changeWatches((all) => all.map((w) => (sameItem(w, query) ? updateWatch(w, report, Date.now()) : w)));
      }
    } finally {
      setPricesLoading(false);
    }
  }

  // The "type it instead" search: skip the photo and the AI, go straight to prices.
  // It's free to run, because it only uses the price sources.
  const [typed, setTyped] = useState("");
  function handleTyped(e: React.FormEvent) {
    e.preventDefault(); // stop the browser from reloading the page (what forms do by default)
    search(typed);
  }
  function search(text: string) {
    const q = text.trim();
    if (!q) return;
    setTyped(q);
    const item: Item = {
      found: true, name: q, brand: "", category: "", confidence: "high",
      description: "", priceLow: 0, priceHigh: 0, searchQuery: q,
    };
    const snap: Snap = { id: crypto.randomUUID(), at: Date.now(), thumb: "", result: { item, links: [], typed: true }, prices: null };
    setThumb("");
    setResult(snap.result);
    setPrices(null);
    setPreview(null);
    setError(null);
    setShowAll(false);
    track("typed_search");
    remember(snap);
    loadPrices(q, snap);
  }

  // The "back to start" button: clears the screen so you can look up something new.
  function reset() {
    setResult(null);
    setPrices(null);
    setPreview(null);
    setError(null);
    setTyped("");
  }

  // Re-opens an old snap from history, no AI or price check needed.
  function openSnap(snap: Snap) {
    setPreview(snap.thumb || null);
    setThumb(snap.thumb);
    setResult(snap.result);
    setPrices(snap.prices);
    setError(null);
    setShowAll(false);
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
  // The camera button (or file picker) hands us a photo here.
  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the user pick the same photo again
    if (file) processFile(file);
  }

  // Runs for every new photo: from the camera, the file picker, or one dragged onto the page.
  async function processFile(file: File) {
    if (loading) return;

    setResult(null);
    setError(null);
    setPrices(null);
    setShowAll(false);
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
        setThumb(snap.thumb);
        remember(snap);
        // Show the item right away, then fetch prices in the background (no "await" here).
        loadPrices(data.item.searchQuery, snap);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false); // stop the loading screen no matter what happened
    }
  }

  const item = result?.item;
  const best = prices?.bestNew ?? prices?.bestUsed ?? null;
  // The big picture next to the result: your photo, or else the first store's product photo.
  const picture = preview ?? prices?.offers.find((o) => o.image)?.image ?? null;
  const offers = prices?.offers ?? [];
  const shownOffers = showAll ? offers : offers.slice(0, 6);
  const home = !result && !loading && !error;
  const hint = useTypingHint(HINTS, home && !typed);
  const watching = Boolean(item && watches.some((w) => sameItem(w, item.searchQuery)));

  // Tells you what shipping costs, in words.
  const shippingText = (o: Offer) =>
    o.shipping === 0 ? "Free shipping" : o.shipping ? `Includes ${money(o.shipping)} shipping` : "Shipping not listed";

  // One clickable store row in the offers list.
  const offerRow = (o: Offer, i: number) => (
    <li key={i}>
      <a className="offer" href={o.url} target="_blank" rel="noopener noreferrer sponsored"
        onClick={() => track("offer_click", { store: o.store, total: o.total })}>
        <StoreBadge store={o.store} />
        <span className="offer-text">
          <span className="offer-store">{o.store}</span>
          <span className="offer-title">{o.title}</span>
        </span>
        <span className="offer-tags">
          {o.condition === "used" && <span className="pill">Used</span>}
          {!o.trusted && <span className="pill warn">Unverified</span>}
        </span>
        <span className="offer-price">{money(o.total)}</span>
      </a>
    </li>
  );

  return (
    <div className="page"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => { if (!e.relatedTarget) setDragging(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f?.type.startsWith("image/")) processFile(f);
      }}>
      {dragging && !home && <div className="drop-overlay mono">Drop to scan</div>}
      {/* The top bar: logo on the left. Tapping it goes back to the start. */}
      <header className="topbar">
        <button className="brand" onClick={reset} aria-label="SnapFind home">
          <span className="brand-mark"><Icon name="search" size={18} /></span>
          SnapFind
        </button>
        <span className="topbar-note mono"><span className="dot-live" /> System online</span>
      </header>

      <main className={home ? "wrap home" : "wrap"}>
        {home && (
          <section className="hero">
            <p className="eyebrow mono"><Icon name="spark" size={14} /> Visual search engine v2</p>
            <h1><Scramble text="Find anything." /><br /><Scramble className="grad" text="Pay less for it." /></h1>
            <p className="sub">Take a photo of sneakers, a gadget, a car, anything. We tell you what it is and which store has the best price.</p>
          </section>
        )}

        {/* The search bar: type here, or tap the camera to snap a photo. */}
        <form className="searchbar" onSubmit={handleTyped}>
          <span className="searchbar-icon"><Icon name="search" /></span>
          <input
            ref={searchRef}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={home ? `Try "${hint}"` : "Search any product"}
            maxLength={200}
            aria-label="Search for a product"
          />
          {/* capture="environment" opens the back camera on phones. On a laptop it opens a file picker. */}
          <label className="icon-btn" title="Snap a photo" aria-label="Snap a photo">
            <Icon name="camera" />
            <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} disabled={loading} hidden />
          </label>
          <kbd className="kbd mono" aria-hidden="true">/</kbd>
          <button type="submit" className="go" disabled={!typed.trim() || pricesLoading} aria-label="Search">
            <Icon name="arrow" />
          </button>
        </form>

        {/* "Price drop!" news from the check we did when you opened the app. */}
        {home && drops.map((w) => (
          <a key={w.id} className="drop" href={w.url ?? "#"} target="_blank" rel="noopener noreferrer sponsored"
            onClick={() => track("deal_click", { store: w.store ?? "", total: w.price ?? 0, from: "drop" })}>
            <Icon name="bell" size={18} />
            <span><strong>Price drop!</strong> {w.name} is now {money(w.price!)} at {w.store}.</span>
          </a>
        ))}

        {home && (
          <>
            <div className="chips">
              <span className="chips-label">Try</span>
              {["AirPods Pro 2", "PS5 Slim", "Jordan 1 Chicago", "Stanley Quencher"].map((q) => (
                <button key={q} className="chip" onClick={() => search(q)}>{q}</button>
              ))}
            </div>
            <Viewfinder onFile={processFile} disabled={loading} />
            <ol className="steps">
              <li className="spot"><b className="mono">01</b><span><strong>Snap or search</strong>Photo or name, either works.</span></li>
              <li className="spot"><b className="mono">02</b><span><strong>AI identifies it</strong>The exact product and its typical price.</span></li>
              <li className="spot"><b className="mono">03</b><span><strong>Pay the least</strong>Every store compared, best deal on top.</span></li>
            </ol>
          </>
        )}

        {result?.demo && (
          <p className="banner">Demo mode: this is a sample result. Real recognition turns on once the AI key is added.</p>
        )}

        {/* While the AI looks at the photo, show grey "skeleton" shapes instead of a spinner. */}
        {loading && (
          <section className="result spot">
            <div className="media">{preview && <img src={preview} alt="Your photo" />}<span className="scan" /></div>
            <div className="info">
              <p className="eyebrow mono">Scanning…</p>
              <ScanLog mode="photo" />
            </div>
          </section>
        )}

        {error && <p className="banner error">{error}</p>}

        {result && !item?.found && (
          <section className="result spot">
            {preview && <div className="media"><img src={preview} alt="Your photo" /></div>}
            <div className="info">
              <h2>Couldn&apos;t spot anything to buy</h2>
              <p className="desc">Try getting closer to the item, or type its name in the search bar.</p>
            </div>
          </section>
        )}

        {item?.found && (
          <>
            {/* A typed search with no product photo yet skips the big picture box. */}
            <section className={picture || !result?.typed ? "result" : "result solo"}>
              {(picture || !result?.typed) && (
                <div className="media">
                  {picture ? <img src={picture} alt={item.name} /> : <span className="monogram"><span className="grad">{item.name.slice(0, 1).toUpperCase()}</span></span>}
                </div>
              )}
              <div className="info">
                <p className="eyebrow">
                  {result?.typed ? "Your search" : item.category}
                  {!result?.typed && <span className="dot">{item.confidence} confidence</span>}
                  {result?.cached && <span className="instant"><Icon name="bolt" size={12} /> Instant</span>}
                </p>
                <h2>{item.name}</h2>
                {item.description && <p className="desc">{item.description}</p>}
                <div className="facts">
                  {item.priceHigh > 0 && (
                    <span className="fact">
                      <small>Typical price</small>
                      {money(item.priceLow)}{item.priceHigh !== item.priceLow && <> – {money(item.priceHigh)}</>}
                    </span>
                  )}
                  {offers.length > 0 && (
                    <span className="fact"><small>Offers found</small>{offers.length}</span>
                  )}
                  {prices?.savings ? (
                    <span className="fact good"><small>You save up to</small>{money(prices.savings)}</span>
                  ) : null}
                </div>
                <div className="actions">
                  <button className={watching ? "ghost on" : "ghost"} onClick={toggleWatch} aria-pressed={watching}>
                    <Icon name="bell" size={16} /> {watching ? "Watching price" : "Watch price"}
                  </button>
                  <button className="ghost" onClick={share} disabled={pricesLoading}><Icon name="share" size={16} /> Share</button>
                  <button className="ghost" onClick={reset}><Icon name="back" size={16} /> New search</button>
                </div>
              </div>
            </section>

            {pricesLoading && (
              <section className="panel spot">
                <p className="panel-title mono">Comparing prices…</p>
                <ScanLog mode="prices" />
              </section>
            )}

            {/* The winner: the cheapest store we trust. */}
            {best && !pricesLoading && (
              <section className="deal-grid">
                {[prices?.bestNew && { label: "Best new price", o: prices.bestNew }, prices?.bestUsed && { label: "Best used price", o: prices.bestUsed }]
                  .filter((d): d is { label: string; o: Offer } => Boolean(d))
                  .map(({ label, o }, i) => (
                    <DealCard key={label} label={label} offer={o} top={i === 0} shipping={shippingText(o)} />
                  ))}
              </section>
            )}

            {offers.length > 0 && !pricesLoading && (
              <section className="panel spot">
                <p className="panel-title">
                  All prices <span className="muted">from {prices!.sourcesUsed.join(" + ")}, cheapest first</span>
                </p>
                <ul className="offers">{shownOffers.map(offerRow)}</ul>
                {offers.length > 6 && (
                  <button className="more" onClick={() => setShowAll(!showAll)}>
                    {showAll ? "Show fewer" : `Show all ${offers.length} offers`}
                  </button>
                )}
              </section>
            )}

            {/* Store buttons: search the item on each store's own site. */}
            {result!.links.length > 0 && !pricesLoading && (
              <section className="panel spot">
                <p className="panel-title">
                  {prices && !prices.configured
                    ? "Compare it yourself"
                    : prices?.configured && offers.length === 0
                      ? "No live prices found. Check these stores"
                      : "Search other stores"}
                </p>
                {prices && !prices.configured && (
                  <p className="muted small">Live price comparison is coming soon. For now, jump straight to the search on each store.</p>
                )}
                <div className="stores">
                  {result!.links.map((l) => (
                    <a key={l.store} className="store spot" href={l.url} target="_blank" rel="noopener noreferrer sponsored"
                      onClick={() => track("store_link_click", { store: l.store })}>
                      <StoreBadge store={l.store} size={32} />
                      <span>{l.store}</span>
                      <Icon name="external" size={15} />
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* US law (the FTC) says you must tell people when links can earn you money. */}
            {result?.affiliate && <p className="disclosure">SnapFind may earn a commission from purchases through these links.</p>}
          </>
        )}

        {watches.length > 0 && (
          <section className="history watching">
            <p className="panel-title">Watching <span className="muted">· we re-check prices every time you open SnapFind</span></p>
            <div className="history-row">
              {watches.map((w) => {
                const drop = dropAmount(w);
                return (
                  <div key={w.id} className="history-item watch">
                    <button className="watch-open" onClick={() => search(w.query)} aria-label={`Check ${w.name} again`}>
                      {w.thumb ? <img src={w.thumb} alt="" /> : <span className="monogram small"><span className="grad">{w.name.slice(0, 1).toUpperCase()}</span></span>}
                      <span className="history-name">{w.name}</span>
                      <span className="history-meta">
                        {w.price !== null ? money(w.price) : "No price yet"}
                        {drop > 0 && <span className="down"> ↓ {money(drop)}</span>}
                      </span>
                    </button>
                    <button className="unwatch" onClick={() => changeWatches((all) => all.filter((x) => x.id !== w.id))} aria-label={`Stop watching ${w.name}`}>×</button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {history.length > 0 && (
          <section className="history">
            <p className="panel-title">Recent</p>
            <div className="history-row">
              {history.map((snap) => {
                const top = snap.prices?.bestNew ?? snap.prices?.bestUsed;
                return (
                  <button key={snap.id} className="history-item" onClick={() => openSnap(snap)}>
                    {snap.thumb ? <img src={snap.thumb} alt="" /> : <span className="monogram small"><span className="grad">{snap.result.item.name.slice(0, 1).toUpperCase()}</span></span>}
                    <span className="history-name">{snap.result.item.name}</span>
                    <span className="history-meta">{top ? money(top.total) : ago(snap.at)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </main>
      <footer className="foot">SnapFind · prices change often, always check the store before buying</footer>
    </div>
  );
}
