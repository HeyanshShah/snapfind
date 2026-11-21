// lib/identify.ts
// This is the "brain" of SnapFind. It sends a photo to an AI vision model (an AI that can see
// pictures) and gets back a neat answer: what the thing is, and roughly what it costs.
//
// SnapFind can use two different AIs. This file is the switchboard that picks one:
// 1. GEMINI_API_KEY set?    -> Google Gemini (has a free tier)
// 2. ANTHROPIC_API_KEY set? -> Anthropic (paid, about a cent per photo)
// 3. Neither?               -> demo mode (see lib/demo.ts)
// Because both fill in the same form (lib/item.ts), nothing else in the app has to care which.

import { identifyWithGemini } from "./ai/gemini.ts";
import { identifyWithAnthropic } from "./ai/anthropic.ts";
import type { Item, ImageType } from "./item.ts";

export type { Item, ImageType } from "./item.ts";
export { AiBusyError, AiKeyError } from "./ai/errors.ts";

export function aiProvider(): "gemini" | "anthropic" | null {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

// identifyItem = "here's a photo, tell me what it is."
// base64 is the photo turned into a long string of letters so it can travel over the internet.
export async function identifyItem(base64: string, mediaType: ImageType): Promise<Item> {
  const provider = aiProvider();
  if (provider === "gemini") return identifyWithGemini(base64, mediaType);
  if (provider === "anthropic") return identifyWithAnthropic(base64, mediaType);
  throw new Error("No AI key is set up.");
}
