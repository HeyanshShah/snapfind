// lib/ai/anthropic.ts
// The paid option: asks Anthropic's vision model what's in the photo (about a cent per photo).
// Used only when ANTHROPIC_API_KEY is set and GEMINI_API_KEY is not.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ItemSchema, INSTRUCTIONS, type Item, type ImageType } from "../item.ts";
import { AiBusyError, AiKeyError } from "./errors.ts";

// One shared connection to the AI service, made the first time it's needed. It reads your
// secret key from the ANTHROPIC_API_KEY setting, so the key never appears in our code.
let client: Anthropic | null = null;

export async function identifyWithAnthropic(base64: string, mediaType: ImageType): Promise<Item> {
  let response;
  try {
    client ??= new Anthropic();
    response = await client.beta.messages.parse({
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
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) throw new AiBusyError();
    if (err instanceof Anthropic.AuthenticationError) throw new AiKeyError();
    throw err;
  }

  // parsed_output is the filled-in form. If it's missing, something went wrong.
  if (!response.parsed_output) {
    throw new Error(`The AI didn't return an answer (stop reason: ${response.stop_reason}).`);
  }
  return response.parsed_output;
}
