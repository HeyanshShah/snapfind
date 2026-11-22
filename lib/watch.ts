// lib/watch.ts
// The watch list: "tell me when this gets cheaper."
// You tap "Watch price" and we write down today's best price. Every time you open the app,
// we quietly check the price again. If it went down, we show you how much you'd save.
//
// This file is only rules (no screen, no internet), so it's easy to test.

import type { PriceReport } from "./prices/index.ts";

export type Watch = {
  id: string;
  name: string; // what you're watching, e.g. "PS5 Slim"
  query: string; // what we search for at the stores
  category: string;
  thumb: string; // tiny photo, or "" for typed searches
  demo: boolean; // watched from a demo-mode sample (keeps using sample prices)
  addedAt: number;
  startPrice: number | null; // best price when you started watching (null = not known yet)
  price: number | null; // best price at the last check
  store: string | null; // who has that price
  url: string | null; // where to buy at that price
  lowest: number | null; // cheapest price we've ever seen for it
  checkedAt: number; // when we last checked (0 = never)
};

export const WATCH_MAX = 12; // more than this and every visit would fire too many price checks
export const RECHECK_AFTER = 6 * 60 * 60 * 1000; // check each item at most every 6 hours

// The single best price in a report: the best new deal, or the best used one if there's no new.
function bestOf(report: PriceReport | null) {
  return report?.bestNew ?? report?.bestUsed ?? null;
}

// Makes a new watch from what's on screen right now.
export function newWatch(
  item: { name: string; searchQuery: string; category: string },
  report: PriceReport | null,
  opts: { id: string; thumb: string; demo: boolean; now: number },
): Watch {
  const best = bestOf(report);
  return {
    id: opts.id,
    name: item.name,
    query: item.searchQuery,
    category: item.category,
    thumb: opts.thumb,
    demo: opts.demo,
    addedAt: opts.now,
    startPrice: best?.total ?? null,
    price: best?.total ?? null,
    store: best?.store ?? null,
    url: best?.url ?? null,
    lowest: best?.total ?? null,
    checkedAt: best ? opts.now : 0,
  };
}

// Writes a fresh price check into the watch. If a check found nothing (store down,
// no keys), we keep the old price instead of pretending it's gone.
export function updateWatch(w: Watch, report: PriceReport, now: number): Watch {
  const best = bestOf(report);
  if (!best) return { ...w, checkedAt: now };
  return {
    ...w,
    startPrice: w.startPrice ?? best.total, // first price we ever got becomes the starting line
    price: best.total,
    store: best.store,
    url: best.url,
    lowest: w.lowest === null ? best.total : Math.min(w.lowest, best.total),
    checkedAt: now,
  };
}

// Is it time to check this one again?
export function needsCheck(w: Watch, now: number): boolean {
  return now - w.checkedAt >= RECHECK_AFTER;
}

// How much cheaper it is now than when you started watching (0 = not cheaper).
export function dropAmount(w: Watch): number {
  if (w.startPrice === null || w.price === null) return 0;
  return Math.max(0, Math.round((w.startPrice - w.price) * 100) / 100);
}

// Same product? We compare the search words, ignoring capital letters and extra spaces.
export function sameItem(w: Watch, query: string): boolean {
  const clean = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  return clean(w.query) === clean(query);
}
