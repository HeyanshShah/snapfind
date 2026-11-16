// lib/prices/google.ts
// Gets prices from Google Shopping, through a service called SerpApi.
// Google doesn't let apps read Shopping results directly, so SerpApi does the search
// for us and hands back neat data. You need a SERPAPI_KEY (free tier: 100 searches/month).

import type { Offer } from "./types.ts";

// Big, well-known stores we trust even when Google doesn't show a rating.
const KNOWN_STORES = [
  "amazon", "walmart", "target", "best buy", "nike", "adidas", "foot locker", "finish line",
  "jd sports", "dick's sporting goods", "nordstrom", "macy's", "stockx", "goat", "flight club",
  "ebay", "home depot", "lowe's", "costco", "apple", "zappos", "champs sports", "kohl's",
];

// The shape of one Google Shopping result (only the fields we use).
export type GoogleResult = {
  title?: string;
  source?: string;
  extracted_price?: number;
  product_link?: string;
  link?: string;
  thumbnail?: string;
  rating?: number;
  delivery?: string;
  second_hand_condition?: string;
  extensions?: string[];
};

// Reads text like "Free delivery" or "$5.99 delivery" and returns 0, 5.99, or null.
export function parseShipping(delivery: string | undefined): number | null {
  if (!delivery) return null;
  if (/free/i.test(delivery)) return 0;
  const match = delivery.match(/\$\s?([\d,]+(?:\.\d+)?)/);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

// Turns one Google result into our standard Offer shape (or null if it's unusable).
export function toOffer(r: GoogleResult): Offer | null {
  const url = r.link ?? r.product_link;
  if (!r.title || !r.source || typeof r.extracted_price !== "number" || !url) return null;

  const shipping = parseShipping(r.delivery);
  // Google marks used items in a few different places, so we check all of them.
  const usedText = [r.second_hand_condition, ...(r.extensions ?? []), r.title].join(" ");
  const used = Boolean(r.second_hand_condition) || /\b(used|pre-owned|preowned|refurbished)\b/i.test(usedText);
  const store = r.source;
  const rating = typeof r.rating === "number" ? r.rating : null;
  const known = KNOWN_STORES.some((s) => store.toLowerCase().includes(s));

  return {
    source: "google",
    store,
    title: r.title,
    price: r.extracted_price,
    shipping,
    total: r.extracted_price + (shipping ?? 0),
    condition: used ? "used" : "new",
    url,
    image: r.thumbnail ?? null,
    rating,
    // Trust = a famous store, OR a store with a rating of 4 stars or more.
    trusted: known || (rating !== null && rating >= 4),
  };
}

export async function searchGoogle(query: string): Promise<Offer[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return []; // no key = skip this source quietly

  const base = process.env.SERPAPI_BASE_URL ?? "https://serpapi.com"; // can be swapped for testing
  const params = new URLSearchParams({ engine: "google_shopping", q: query, gl: "us", hl: "en", api_key: key });
  const res = await fetch(`${base}/search.json?${params}`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Google Shopping search failed (${res.status})`);

  const data = (await res.json()) as { shopping_results?: GoogleResult[] };
  return (data.shopping_results ?? []).map(toOffer).filter((o): o is Offer => o !== null);
}
