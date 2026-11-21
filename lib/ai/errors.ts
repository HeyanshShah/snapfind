// lib/ai/errors.ts
// Each AI company reports problems in its own way. We translate them into two simple
// errors of our own, so the server route only has to understand these two.

// "Too many requests right now" (for the free Gemini tier: the per-minute or daily limit).
export class AiBusyError extends Error {
  constructor() {
    super("The AI is busy");
  }
}

// "The AI key is missing or wrong."
export class AiKeyError extends Error {
  constructor() {
    super("The AI key is missing or wrong");
  }
}
