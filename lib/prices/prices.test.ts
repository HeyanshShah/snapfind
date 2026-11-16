// lib/prices/prices.test.ts
// Tests are little robots that check our code still does what we expect.
// Run them with: npm test
// Each test sets up fake data, runs our code, and checks the answer with assert.

import { test } from "node:test";
import assert from "node:assert/strict";
import { compareOffers } from "./bestDeal.ts";
import { parseShipping, toOffer as googleOffer } from "./google.ts";
import { toOffer as ebayOffer } from "./ebay.ts";
import type { Offer } from "./types.ts";

// A helper that makes a fake offer. We only type the parts each test cares about.
function offer(over: Partial<Offer>): Offer {
  const price = over.price ?? 100;
  const shipping = over.shipping === undefined ? 0 : over.shipping;
  return {
    source: "google", store: "Store", title: "Item", price, shipping,
    total: price + (shipping ?? 0), condition: "new", url: "https://x.test",
    image: null, rating: null, trusted: true, ...over,
  };
}

test("best deal looks at the total price including shipping", () => {
  const a = offer({ store: "A", price: 150, shipping: 15 }); // $165 total
  const b = offer({ store: "B", price: 160, shipping: 0 }); // $160 total
  assert.equal(compareOffers([a, b]).bestNew?.store, "B");
});

test("untrusted sellers never win, even when cheapest", () => {
  const sketchy = offer({ store: "Sketchy", price: 120, trusted: false });
  const legit = offer({ store: "Legit", price: 140 });
  const result = compareOffers([sketchy, legit]);
  assert.equal(result.bestNew?.store, "Legit");
  assert.equal(result.offers.length, 2); // the sketchy one is still listed, just not picked
});

test("new and used get separate winners", () => {
  const result = compareOffers([
    offer({ store: "New", price: 160 }),
    offer({ store: "Used", price: 110, condition: "used" }),
  ]);
  assert.equal(result.bestNew?.store, "New");
  assert.equal(result.bestUsed?.store, "Used");
});

test("way-too-cheap junk (laces, stickers) gets thrown out", () => {
  const result = compareOffers([
    offer({ price: 170 }), offer({ price: 180 }), offer({ price: 190 }),
    offer({ store: "Laces", price: 9 }),
  ]);
  assert.equal(result.removed, 1);
  assert.ok(result.offers.every((o) => o.store !== "Laces"));
});

test("savings = priciest new offer minus the best new deal", () => {
  const result = compareOffers([offer({ price: 150 }), offer({ price: 200 })]);
  assert.equal(result.savings, 50);
});

test("no offers means no winner (and no crash)", () => {
  const result = compareOffers([]);
  assert.equal(result.bestNew, null);
  assert.equal(result.savings, null);
});

test("shipping text is read correctly", () => {
  assert.equal(parseShipping("Free delivery"), 0);
  assert.equal(parseShipping("$5.99 delivery"), 5.99);
  assert.equal(parseShipping("Delivery by Fri"), null);
  assert.equal(parseShipping(undefined), null);
});

test("Google result becomes an Offer, and used items are spotted", () => {
  const o = googleOffer({
    title: "Air Jordan 1 Chicago (Pre-owned)", source: "Flight Club", extracted_price: 300,
    product_link: "https://g.test/p", delivery: "$10 delivery",
  });
  assert.equal(o?.total, 310);
  assert.equal(o?.condition, "used");
  assert.equal(o?.trusted, true); // Flight Club is a known store
});

test("Google results missing a price are skipped", () => {
  assert.equal(googleOffer({ title: "x", source: "y", product_link: "z" }), null);
});

test("eBay listing becomes an Offer with seller trust", () => {
  const good = ebayOffer({
    title: "Jordan 1", price: { value: "210.00", currency: "USD" },
    shippingOptions: [{ shippingCost: { value: "12.50" } }], condition: "New with box",
    itemWebUrl: "https://ebay.test/1", seller: { username: "kicks", feedbackPercentage: "99.6", feedbackScore: 1200 },
  });
  assert.equal(good?.total, 222.5);
  assert.equal(good?.condition, "new");
  assert.equal(good?.trusted, true);

  const newbie = ebayOffer({
    title: "Jordan 1", price: { value: "150", currency: "USD" }, condition: "Pre-owned",
    itemWebUrl: "https://ebay.test/2", seller: { feedbackPercentage: "100", feedbackScore: 3 },
  });
  assert.equal(newbie?.trusted, false); // only 3 reviews: not enough to trust
  assert.equal(newbie?.shipping, null);
});
