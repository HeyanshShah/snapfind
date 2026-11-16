// lib/demo.ts
// "Demo mode": when the AI key isn't set up yet, the app still works and shows a clearly
// labeled SAMPLE answer. That way the live link can be shared with recruiters and friends
// on day one, and nobody thinks it's broken. Real answers take over once the key is added.

import type { Item } from "./identify.ts";
import type { PriceReport } from "./prices/index.ts";
import { compareOffers } from "./prices/bestDeal.ts";
import type { Offer } from "./prices/types.ts";

export function demoMode(): boolean {
  return !process.env.ANTHROPIC_API_KEY;
}

export const DEMO_ITEM: Item = {
  found: true,
  name: "Air Jordan 1 Retro High OG 'Chicago' (sample)",
  brand: "Nike",
  category: "sneakers",
  confidence: "high",
  description: "Demo mode: this is a sample result. Real photo recognition turns on once the AI key is added.",
  priceLow: 180,
  priceHigh: 450,
  searchQuery: "Air Jordan 1 Retro High OG Chicago",
};

const demoOffer = (o: Partial<Offer> & Pick<Offer, "store" | "price">): Offer => {
  const shipping = o.shipping === undefined ? 0 : o.shipping;
  return {
    source: "google", title: DEMO_ITEM.name, condition: "new", image: null, rating: null,
    trusted: true, url: "https://www.google.com/search?tbm=shop&q=Air+Jordan+1+Chicago",
    ...o, shipping, total: o.price + (shipping ?? 0),
  };
};

export function demoPrices(): PriceReport {
  const offers = [
    demoOffer({ store: "Nike (sample)", price: 180 }),
    demoOffer({ store: "Foot Locker (sample)", price: 175, shipping: 8.99 }),
    demoOffer({ store: "StockX (sample)", price: 240, shipping: 14 }),
    demoOffer({ store: "eBay seller (sample)", price: 135, shipping: 10, condition: "used", source: "ebay" }),
    demoOffer({ store: "Unknown shop (sample)", price: 120, trusted: false }),
  ];
  return { ...compareOffers(offers), sourcesUsed: ["Sample data"], sourcesFailed: [], configured: true };
}
