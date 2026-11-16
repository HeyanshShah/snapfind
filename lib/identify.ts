// lib/identify.ts
// This is the "brain" of SnapFind. It sends a photo to an AI vision model (an AI that can see
// pictures) and gets back a neat answer: what the thing is, and roughly what it costs.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
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
const INSTRUCTIONS = `You identify products in photos for a shopping app called SnapFind.
Look at the main object in the photo and fill in the form.
- Be as specific as you can: brand, model, colorway or edition if you can tell.
- If you are not sure of the exact model, give your best guess and set confidence to "low" or "medium".
- priceLow and priceHigh are typical US prices right now (new or resale, whichever is more common), in whole dollars.
- searchQuery should be what a shopper would type to find this exact item.
- If there is nothing purchasable in the photo, set found to false and leave the other text fields empty and prices 0.`;

// One shared connection to the AI service. It reads your secret key from the
// ANTHROPIC_API_KEY setting automatically, so the key never appears in our code.
const client = new Anthropic();

// The image types the AI accepts.
type ImageType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

// identifyItem = "here's a photo, tell me what it is."
// base64 is the photo turned into a long string of letters so it can travel over the internet.
export async function identifyItem(base64: string, mediaType: ImageType): Promise<Item> {
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    // "effort: low" = answer quickly. Identifying a shoe doesn't need deep thinking,
    // and people hate waiting after they snap a photo.
    output_config: { effort: "low", format: betaZodOutputFormat(ItemSchema) },
    // If the AI ever declines to answer, this automatically retries on a backup model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: INSTRUCTIONS,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: "What is this, and what does it cost?" },
        ],
      },
    ],
  });

  // parsed_output is the filled-in form. If it's missing, something went wrong.
  if (!response.parsed_output) {
    throw new Error(`The AI didn't return an answer (stop reason: ${response.stop_reason}).`);
  }
  return response.parsed_output;
}
