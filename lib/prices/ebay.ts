// lib/prices/ebay.ts
// Gets prices from eBay's official, free "Browse" API.
// You need EBAY_CLIENT_ID and EBAY_CLIENT_SECRET from developer.ebay.com.

import type { Offer } from "./types.ts";

const BASE = () => process.env.EBAY_API_BASE ?? "https://api.ebay.com"; // can be swapped for testing

// The shape of one eBay listing (only the fields we use).
export type EbayItem = {
  title?: string;
  price?: { value?: string; currency?: string };
  shippingOptions?: { shippingCost?: { value?: string } }[];
  condition?: string;
  itemWebUrl?: string;
  image?: { imageUrl?: string };
  seller?: { username?: string; feedbackPercentage?: string; feedbackScore?: number };
};

// eBay makes us trade our ID + secret for a short-lived "access token" (like a day pass)
// before we can search. We keep the pass in memory and reuse it until it expires.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(id: string, secret: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const res = await fetch(`${BASE()}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`eBay login failed (${res.status})`);

  const data = (await res.json()) as { access_token: string; expires_in: number };
  // Refresh one minute early so the pass never expires in the middle of a search.
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.value;
}

// Turns one eBay listing into our standard Offer shape (or null if it's unusable).
export function toOffer(item: EbayItem): Offer | null {
  const price = Number(item.price?.value);
  if (!item.title || !item.itemWebUrl || !Number.isFinite(price) || item.price?.currency !== "USD") return null;

  const shipValue = item.shippingOptions?.[0]?.shippingCost?.value;
  const shipping = shipValue === undefined ? null : Number(shipValue);
  const feedback = Number(item.seller?.feedbackPercentage);
  const score = item.seller?.feedbackScore ?? 0;

  return {
    source: "ebay",
    store: item.seller?.username ? `eBay · ${item.seller.username}` : "eBay",
    title: item.title,
    price,
    shipping,
    total: price + (shipping ?? 0),
    condition: /^new/i.test(item.condition ?? "") ? "new" : "used",
    url: item.itemWebUrl,
    image: item.image?.imageUrl ?? null,
    // eBay rates sellers in % (like 99.2%). We turn it into stars out of 5 to match Google.
    rating: Number.isFinite(feedback) ? Math.round((feedback / 20) * 10) / 10 : null,
    // Trust = 98%+ positive feedback from at least 50 buyers.
    trusted: Number.isFinite(feedback) && feedback >= 98 && score >= 50,
  };
}

export async function searchEbay(query: string): Promise<Offer[]> {
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) return []; // no keys = skip this source quietly

  const token = await getToken(id, secret);
  const params = new URLSearchParams({ q: query, limit: "30" });
  const res = await fetch(`${BASE()}/buy/browse/v1/item_summary/search?${params}`, {
    headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`eBay search failed (${res.status})`);

  const data = (await res.json()) as { itemSummaries?: EbayItem[] };
  return (data.itemSummaries ?? []).map(toOffer).filter((o): o is Offer => o !== null);
}
