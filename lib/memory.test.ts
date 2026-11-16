// lib/memory.test.ts
// Robot checkers for the cache and the photo fingerprints. Run with: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { TtlCache } from "./cache.ts";
import { dHash, hammingDistance } from "./imageHash.ts";

test("cache forgets things after they expire", () => {
  let fakeNow = 0; // our pretend clock, so the test doesn't have to really wait
  const cache = new TtlCache<string>(10, 1000, () => fakeNow);
  cache.set("shoe", "Jordan 1");
  fakeNow = 999;
  assert.equal(cache.get("shoe"), "Jordan 1");
  fakeNow = 1001;
  assert.equal(cache.get("shoe"), undefined);
});

test("cache forgets the least recently used thing when full", () => {
  const cache = new TtlCache<number>(2, 60_000);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.get("a"); // "a" was just used, so "b" is now the oldest
  cache.set("c", 3); // too full, so "b" gets forgotten
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("a"), 1);
  assert.equal(cache.get("c"), 3);
});

test("hamming distance counts the different bits", () => {
  assert.equal(hammingDistance("0000000000000000", "0000000000000000"), 0);
  assert.equal(hammingDistance("0000000000000000", "0000000000000003"), 2);
  assert.equal(hammingDistance("ffffffffffffffff", "0000000000000000"), 64);
});

// Makes a test photo: a left-to-right light gradient with a dark square in it.
async function makePhoto(squareX: number, brightness = 1, size = 400): Promise<Buffer> {
  const w = size, h = size;
  const px = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inSquare = x > squareX && x < squareX + size / 4 && y > size / 4 && y < size / 2;
      const v = Math.min(255, Math.round((inSquare ? 20 : 60 + (x / w) * 150) * brightness));
      px.set([v, v, v], (y * w + x) * 3);
    }
  }
  return sharp(px, { raw: { width: w, height: h, channels: 3 } }).jpeg().toBuffer();
}

test("same photo, slightly brighter and smaller, gets a nearly identical fingerprint", async () => {
  const original = await dHash(await makePhoto(50));
  const tweaked = await dHash(await makePhoto(50, 1.1, 300));
  assert.ok(hammingDistance(original, tweaked) <= 6, `distance was ${hammingDistance(original, tweaked)}`);
});

test("a different picture gets a very different fingerprint", async () => {
  const a = await dHash(await makePhoto(50));
  // A mirrored gradient with the square somewhere else: a genuinely different image.
  const flipped = await dHash(await sharp(await makePhoto(250)).flop().toBuffer());
  assert.ok(hammingDistance(a, flipped) > 20, `distance was ${hammingDistance(a, flipped)}`);
});
