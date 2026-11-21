// lib/ai/gemini.ts
// Asks Google's Gemini AI what's in the photo. Gemini has a FREE tier (no credit card):
// get a key at aistudio.google.com and set it as GEMINI_API_KEY.
// Free-tier limits: a set number of requests per minute and per day, and Google may use
// what's sent to improve its models. Fine for building and early launch.

import { GoogleGenAI, ApiError } from "@google/genai";
import { z } from "zod";
import { ItemSchema, INSTRUCTIONS, type Item, type ImageType } from "../item.ts";
import { AiBusyError, AiKeyError } from "./errors.ts";

// Which Gemini models to try, best first. Free-tier models are sometimes "busy" (Google
// says high demand) or get retired, so if one fails we quietly try the next one.
// This pattern is called a "fallback chain". GEMINI_MODEL picks one specific model instead.
// Checked against Google's live model list on 2026-11-21.
const MODELS = () =>
  process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

// These error codes mean "this model can't answer right now, try another":
// 404 = model retired, 429 = too many requests, 500/503 = Google is overloaded.
const TRY_NEXT = new Set([404, 429, 500, 503]);

// z.toJSONSchema turns our fill-in form into "JSON Schema", the standard way to describe a
// form that Gemini understands. Gemini then answers ONLY in that shape.
const RESPONSE_SCHEMA = z.toJSONSchema(ItemSchema);

let client: GoogleGenAI | null = null;

export async function identifyWithGemini(base64: string, mediaType: ImageType): Promise<Item> {
  client ??= new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      // Give up on a model after 15 seconds and try the next one, so nobody waits forever.
      timeout: 15_000,
      // GEMINI_BASE_URL is only for testing with a pretend server. Normally it's not set.
      ...(process.env.GEMINI_BASE_URL ? { baseUrl: process.env.GEMINI_BASE_URL } : {}),
    },
  });

  let text: string | undefined;
  let lastError: unknown;
  for (const model of MODELS()) {
    try {
      text = await ask(client, model, base64, mediaType);
      break; // it worked, stop trying
    } catch (err) {
      lastError = err;
      if (err instanceof ApiError && TRY_NEXT.has(err.status)) continue; // busy or gone: next model
      if (err instanceof ApiError && (err.status === 400 || err.status === 401 || err.status === 403) && /key|permission|auth/i.test(err.message)) {
        throw new AiKeyError();
      }
      throw err;
    }
  }
  // Every model was busy: tell the user to try again in a moment.
  if (text === undefined && lastError instanceof ApiError) throw new AiBusyError();

  if (!text) throw new Error("The AI didn't return an answer.");
  // Double-check the AI really filled in the form correctly. safeParse never crashes:
  // it tells us "success" or "here's what's wrong."
  const parsed = ItemSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error("The AI's answer was missing some details.");
  return parsed.data;
}

// One question to one model. Returns the AI's answer as JSON text.
async function ask(client: GoogleGenAI, model: string, base64: string, mediaType: ImageType): Promise<string | undefined> {
  const response = await client.models.generateContent({
    model,
    contents: [
      { inlineData: { mimeType: mediaType, data: base64 } },
      { text: "What is this, and what does it cost?" },
    ],
    config: {
      systemInstruction: INSTRUCTIONS,
      responseMimeType: "application/json",
      responseJsonSchema: RESPONSE_SCHEMA,
    },
  });
  return response.text;
}
