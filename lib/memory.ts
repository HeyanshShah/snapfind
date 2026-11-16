// lib/memory.ts
// The app's shared short-term memory, used by our server routes.
// It lives on the server, so if 100 people snap the same hyped sneaker, the AI only
// gets asked about it once, and everyone after that gets an instant answer.

import { TtlCache } from "./cache.ts";
import type { Item } from "./identify.ts";
import type { PriceReport } from "./prices/index.ts";
import { hammingDistance } from "./imageHash.ts";

const HOUR = 60 * 60 * 1000;

// Photo fingerprint -> what the AI said it was. Products don't change, so keep for a week.
export const identifyCache = new TtlCache<Item>(5000, 7 * 24 * HOUR);

// Search words -> live prices. Prices DO change, so only keep them for 30 minutes.
export const priceCache = new TtlCache<PriceReport>(2000, HOUR / 2);

// How many of the 64 fingerprint bits may differ and still count as "the same photo".
// Tested: re-saved or slightly brighter copies land at 0-5, different objects at 20+.
export const SAME_PHOTO_DISTANCE = 6;

// Find a remembered photo whose fingerprint is close enough to this one.
export function findSimilar(hash: string): Item | undefined {
  const exact = identifyCache.get(hash);
  if (exact) return exact;
  let best: { item: Item; distance: number } | undefined;
  for (const [key, item] of identifyCache.entries()) {
    const distance = hammingDistance(hash, key);
    if (distance <= SAME_PHOTO_DISTANCE && (!best || distance < best.distance)) best = { item, distance };
  }
  return best?.item;
}
