// lib/launch.test.ts
// Robot checkers for the money and safety features. Run with: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { addAffiliate } from "./affiliate.ts";
import { RateLimiter } from "./rateLimit.ts";
import { demoPrices } from "./demo.ts";

test("links stay normal when no affiliate IDs are set up", () => {
  delete process.env.AMAZON_ASSOCIATE_TAG;
  delete process.env.EBAY_CAMPAIGN_ID;
  assert.equal(addAffiliate("https://www.amazon.com/s?k=jordan"), "https://www.amazon.com/s?k=jordan");
});

test("Amazon links get the associate tag", () => {
  process.env.AMAZON_ASSOCIATE_TAG = "snapfind-20";
  const url = new URL(addAffiliate("https://www.amazon.com/s?k=jordan+1"));
  assert.equal(url.searchParams.get("tag"), "snapfind-20");
  assert.equal(url.searchParams.get("k"), "jordan 1"); // the search is untouched
  delete process.env.AMAZON_ASSOCIATE_TAG;
});

test("eBay links get the campaign ID, other stores are left alone", () => {
  process.env.EBAY_CAMPAIGN_ID = "5338000000";
  assert.equal(new URL(addAffiliate("https://www.ebay.com/itm/123")).searchParams.get("campid"), "5338000000");
  assert.equal(addAffiliate("https://www.nike.com/t/air-jordan-1"), "https://www.nike.com/t/air-jordan-1");
  // A sneaky look-alike address must NOT count as eBay.
  assert.equal(addAffiliate("https://ebay.com.scam.test/x"), "https://ebay.com.scam.test/x");
  delete process.env.EBAY_CAMPAIGN_ID;
});

test("rate limiter allows the limit, then blocks until the window resets", () => {
  let fakeNow = 0;
  const limiter = new RateLimiter(3, 60_000, () => fakeNow);
  assert.equal(limiter.check("me"), 0);
  assert.equal(limiter.check("me"), 0);
  assert.equal(limiter.check("me"), 0);
  assert.equal(limiter.check("me"), 60); // 4th try: wait 60 seconds
  assert.equal(limiter.check("someone-else"), 0); // other visitors aren't affected
  fakeNow = 60_000;
  assert.equal(limiter.check("me"), 0); // new hour, new bucket
});

test("demo prices still go through the real best-deal judge", () => {
  const report = demoPrices();
  assert.equal(report.bestNew?.store, "Nike (sample)"); // $180 free shipping beats $175 + $8.99
  assert.equal(report.bestUsed?.condition, "used");
  assert.ok(report.offers.some((o) => !o.trusted)); // the sketchy one is listed but didn't win
});
