// lib/prices/index.ts
// The manager. Asks every price source at the SAME time (not one after another,
// which would be slower), collects the answers, and hands them to the judge.

import { searchGoogle } from "./google.ts";
import { searchEbay } from "./ebay.ts";
import { compareOffers, type Comparison } from "./bestDeal.ts";
import { addAffiliate } from "../affiliate.ts";

export type PriceReport = Comparison & {
  sourcesUsed: string[]; // which sources answered
  sourcesFailed: string[]; // which sources broke (the rest still work)
  configured: boolean; // false if no price keys are set up at all
};

// True when at least one price source has its keys set up.
export function priceSourcesConfigured(): boolean {
  return Boolean(process.env.SERPAPI_KEY || (process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET));
}

export async function getPrices(query: string): Promise<PriceReport> {
  const sources = [
    { name: "Google Shopping", run: searchGoogle, on: Boolean(process.env.SERPAPI_KEY) },
    { name: "eBay", run: searchEbay, on: Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET) },
  ].filter((s) => s.on);

  // Promise.allSettled = "start them all, wait for all, and don't panic if one fails."
  const results = await Promise.allSettled(sources.map((s) => s.run(query)));

  const sourcesUsed: string[] = [];
  const sourcesFailed: string[] = [];
  const offers = results.flatMap((r, i) => {
    if (r.status === "fulfilled") {
      sourcesUsed.push(sources[i].name);
      // Turn each buy link into an affiliate link (if that store's program is set up).
      return r.value.map((o) => ({ ...o, url: addAffiliate(o.url) }));
    }
    console.error(`${sources[i].name} failed:`, r.reason);
    sourcesFailed.push(sources[i].name);
    return [];
  });

  return { ...compareOffers(offers), sourcesUsed, sourcesFailed, configured: sources.length > 0 };
}
