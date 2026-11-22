// lib/watch.test.ts
// Robot checkers for the watch list. Run with: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { newWatch, updateWatch, needsCheck, dropAmount, sameItem, RECHECK_AFTER } from "./watch.ts";
import type { PriceReport } from "./prices/index.ts";
import type { Offer } from "./prices/types.ts";

function report(total: number | null, store = "Nike"): PriceReport {
  const offer: Offer | null = total === null ? null : {
    source: "google", store, title: "x", price: total, shipping: 0, total,
    condition: "new", url: `https://${store.toLowerCase()}.test`, image: null, rating: null, trusted: true,
  };
  return {
    bestNew: offer, bestUsed: null, offers: offer ? [offer] : [], savings: null, removed: 0,
    sourcesUsed: ["Google Shopping"], sourcesFailed: [], configured: true,
  };
}

const item = { name: "PS5 Slim", searchQuery: "PS5 Slim", category: "console" };
const opts = { id: "1", thumb: "", demo: false, now: 1000 };

test("a new watch remembers today's best price", () => {
  const w = newWatch(item, report(450), opts);
  assert.equal(w.startPrice, 450);
  assert.equal(w.price, 450);
  assert.equal(w.lowest, 450);
  assert.equal(dropAmount(w), 0);
});

test("a cheaper price later shows as a drop, and the lowest is remembered", () => {
  let w = newWatch(item, report(450), opts);
  w = updateWatch(w, report(399.5, "Walmart"), 2000);
  assert.equal(dropAmount(w), 50.5);
  assert.equal(w.store, "Walmart");
  w = updateWatch(w, report(420), 3000); // price went back up a bit
  assert.equal(dropAmount(w), 30);
  assert.equal(w.lowest, 399.5);
});

test("a price going UP is not a drop", () => {
  const w = updateWatch(newWatch(item, report(450), opts), report(500), 2000);
  assert.equal(dropAmount(w), 0);
});

test("a failed check keeps the old price", () => {
  const w = updateWatch(newWatch(item, report(450), opts), report(null), 2000);
  assert.equal(w.price, 450);
  assert.equal(w.checkedAt, 2000);
});

test("watching with no price yet: the first price found becomes the starting line", () => {
  let w = newWatch(item, null, opts);
  assert.equal(w.startPrice, null);
  assert.equal(w.checkedAt, 0); // never checked, so it gets checked right away
  w = updateWatch(w, report(300), 5000);
  assert.equal(w.startPrice, 300);
  assert.equal(dropAmount(w), 0);
});

test("prices are re-checked at most every 6 hours", () => {
  const w = newWatch(item, report(450), opts);
  assert.equal(needsCheck(w, 1000 + 60_000), false);
  assert.equal(needsCheck(w, 1000 + RECHECK_AFTER), true);
});

test("same item ignores capitals and extra spaces", () => {
  const w = newWatch(item, null, opts);
  assert.equal(sameItem(w, "  ps5   slim "), true);
  assert.equal(sameItem(w, "PS5 Pro"), false);
});
