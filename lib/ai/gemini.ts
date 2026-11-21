// lib/ai/gemini.ts
// Asks Google's Gemini AI what's in the photo. Gemini has a FREE tier (no credit card):
// get a key at aistudio.google.com and set it as GEMINI_API_KEY.
// Free-tier limits: a set number of requests per minute and per day, and Google may use
// what's sent to improve its models. Fine for building and early launch.

import { GoogleGenAI, ApiError } from "@google/genai";
import { z } from "zod";
import { ItemSchema, INSTRUCTIONS, type Item, type ImageType } from "../item.ts";
import { AiBusyError, AiKeyError } from "./errors.ts";

// "gemini-flash-latest" always points at Google's newest fast model, so the app doesn't
// break when Google retires an old one. You can pick a specific model with GEMINI_MODEL.
const MODEL = () => process.env.GEMINI_MODEL || "gemini-flash-latest";

// z.toJSONSchema turns our fill-in form into "JSON Schema", the standard way to describe a
// form that Gemini understands. Gemini then answers ONLY in that shape.
const RESPONSE_SCHEMA = z.toJSONSchema(ItemSchema);

let client: GoogleGenAI | null = null;

export async function identifyWithGemini(base64: string, mediaType: ImageType): Promise<Item> {
  client ??= new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    // GEMINI_BASE_URL is only for testing with a pretend server. Normally it's not set.
    ...(process.env.GEMINI_BASE_URL ? { httpOptions: { baseUrl: process.env.GEMINI_BASE_URL } } : {}),
  });

  let text: string | undefined;
  try {
    const response = await client.models.generateContent({
      model: MODEL(),
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
    text = response.text;
  } catch (err) {
    // Turn Google's error codes into our own simple error types.
    if (err instanceof ApiError && err.status === 429) throw new AiBusyError();
    if (err instanceof ApiError && (err.status === 400 || err.status === 401 || err.status === 403) && /key/i.test(err.message)) {
      throw new AiKeyError();
    }
    throw err;
  }

  if (!text) throw new Error("The AI didn't return an answer.");
  // Double-check the AI really filled in the form correctly. safeParse never crashes:
  // it tells us "success" or "here's what's wrong."
  const parsed = ItemSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error("The AI's answer was missing some details.");
  return parsed.data;
}
