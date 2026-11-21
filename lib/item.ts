// lib/item.ts
// The answer form every AI fills in, plus the job description we give it.
// Both AI providers (lib/ai/gemini.ts and lib/ai/anthropic.ts) use these same two things,
// so the rest of the app gets the exact same answer shape no matter which AI is used.

import { z } from "zod";

// A "schema" is a fill-in-the-blanks form. We tell the AI: "answer ONLY by filling in
// this form." That way we always get the same shape back and our code never breaks.
export const ItemSchema = z.object({
  found: z.boolean(), // false if the photo has nothing to buy (a blurry wall, a sunset...)
  name: z.string(), // e.g. "Nike Air Jordan 1 Retro High OG 'Chicago'"
  brand: z.string(), // e.g. "Nike" (empty string if unknown)
  category: z.string(), // e.g. "sneakers", "car", "plant", "jacket"
  confidence: z.enum(["high", "medium", "low"]), // how sure the AI is
  description: z.string(), // one short, fun sentence about the item
  priceLow: z.number(), // cheapest typical price in US dollars (0 if unknown)
  priceHigh: z.number(), // most expensive typical price in US dollars
  searchQuery: z.string(), // the best words to type into a shopping site to find it
});

// "type Item" lets the rest of our code know exactly what fields an Item has.
export type Item = z.infer<typeof ItemSchema>;

// The instructions we give the AI every time. Think of it as the job description.
export const INSTRUCTIONS = `You identify products in photos for a shopping app called SnapFind.
Look at the main object in the photo and fill in the form.
- Be as specific as you can: brand, model, colorway or edition if you can tell.
- If you are not sure of the exact model, give your best guess and set confidence to "low" or "medium".
- priceLow and priceHigh are typical US prices right now (new or resale, whichever is more common), in whole dollars.
- searchQuery should be what a shopper would type to find this exact item.
- If there is nothing purchasable in the photo, set found to false and leave the other text fields empty and prices 0.`;

// The image types the AI accepts.
export type ImageType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";
