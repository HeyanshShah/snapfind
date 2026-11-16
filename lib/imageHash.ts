// lib/imageHash.ts
// A "fingerprint" for photos, so we can tell when two photos show the same thing.
//
// How it works (this trick is called a "difference hash" or dHash):
// 1. Shrink the photo to a tiny 9x8 grayscale picture. All the small details disappear,
//    only the big shapes and light/dark areas are left.
// 2. In each row, compare each pixel with its right-hand neighbor:
//    brighter on the left = 1, otherwise = 0. That's 8 rows x 8 comparisons = 64 bits.
// 3. Those 64 ones-and-zeros are the fingerprint, written as 16 hex characters.
//
// Two photos of the same shoe give almost the same fingerprint, even if one is a bit
// brighter, blurrier, or a different size. To compare fingerprints we count how many of the
// 64 bits are different. That count is called the "Hamming distance". 0 = identical.

import sharp from "sharp";

export async function dHash(image: Buffer): Promise<string> {
  const pixels = await sharp(image)
    .rotate() // respect the phone's "this photo is sideways" flag
    .grayscale()
    .resize(9, 8, { fit: "fill" })
    .raw()
    .toBuffer();

  let bits = 0n; // "n" makes a BigInt, a number type that can hold all 64 bits safely
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = pixels[row * 9 + col];
      const right = pixels[row * 9 + col + 1];
      bits = (bits << 1n) | (left > right ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, "0");
}

// Counts how many bits differ between two fingerprints.
export function hammingDistance(a: string, b: string): number {
  let x = BigInt("0x" + a) ^ BigInt("0x" + b); // XOR: 1 wherever the bits differ
  let count = 0;
  while (x > 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}
