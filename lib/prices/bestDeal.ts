// lib/prices/bestDeal.ts
// The judge. Takes every offer from every store and decides which one is the best deal.
// It has no internet code in it at all, just rules. That makes it easy to test.

import type { Offer } from "./types.ts";

export type Comparison = {
  bestNew: Offer | null; // cheapest new one from a seller we trust
  bestUsed: Offer | null; // cheapest used one from a seller we trust
  offers: Offer[]; // everything we kept, cheapest first
  savings: number | null; // how much the best new deal saves vs. the priciest new offer
  removed: number; // how many listings we threw out as junk
};

// The middle number of a list. Half the prices are below it, half above.
function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Cheapest first. If two cost the same, the one with known shipping wins (no surprises).
function byTotal(a: Offer, b: Offer): number {
  return a.total - b.total || Number(a.shipping === null) - Number(b.shipping === null);
}

function cheapestTrusted(offers: Offer[]): Offer | null {
  return offers.filter((o) => o.trusted).sort(byTotal)[0] ?? null;
}

export function compareOffers(all: Offer[]): Comparison {
  // Step 1: throw out junk. Searching "Jordan 1" also finds $9 laces and $5 stickers.
  // Anything way cheaper than the typical price (under 35% of the middle price) is
  // probably an accessory or a scam, so we drop it.
  const valid = all.filter((o) => o.total > 0);
  const middle = valid.length ? median(valid.map((o) => o.total)) : 0;
  const offers = valid.filter((o) => o.total >= middle * 0.35).sort(byTotal);

  // Step 2: split into new and used. A used shoe isn't a fair fight against a new one.
  const fresh = offers.filter((o) => o.condition === "new");
  const used = offers.filter((o) => o.condition === "used");

  // Step 3: in each group, the winner is the cheapest offer from a seller we trust.
  const bestNew = cheapestTrusted(fresh);
  const bestUsed = cheapestTrusted(used);

  // Step 4: how much you save by picking our best new deal instead of the most expensive one.
  const maxNew = fresh.length ? Math.max(...fresh.map((o) => o.total)) : 0;
  const savings = bestNew && maxNew > bestNew.total ? Math.round((maxNew - bestNew.total) * 100) / 100 : null;

  return { bestNew, bestUsed, offers, savings, removed: all.length - offers.length };
}
