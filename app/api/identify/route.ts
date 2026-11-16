// app/api/identify/route.ts
// This is our "server": code that runs on a computer we control, not on the user's phone.
// The phone sends a photo here, we ask the AI, and we send the answer back.
// Why not ask the AI straight from the phone? Because then we'd have to put our secret
// API key on the phone, and anyone could steal it. The server keeps it hidden.

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { identifyItem } from "@/lib/identify";
import { buildShopLinks } from "@/lib/shopLinks";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type Allowed = (typeof ALLOWED)[number];

// Photos bigger than this get rejected, so nobody can clog our server.
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// "POST" means "the phone is sending us something" (the photo).
export async function POST(request: Request) {
  // 1. Open the package the phone sent and pull out the photo.
  const form = await request.formData();
  const photo = form.get("photo");
  if (!(photo instanceof File)) {
    return NextResponse.json({ error: "No photo was sent." }, { status: 400 });
  }
  if (!ALLOWED.includes(photo.type as Allowed)) {
    return NextResponse.json({ error: "Please send a JPG, PNG, WebP, or GIF." }, { status: 400 });
  }
  if (photo.size > MAX_BYTES) {
    return NextResponse.json({ error: "That photo is too big (max 5 MB)." }, { status: 400 });
  }

  // 2. Turn the photo into base64 text so it can be sent to the AI.
  const base64 = Buffer.from(await photo.arrayBuffer()).toString("base64");

  // 3. Ask the AI, and catch problems so the app shows a friendly message instead of crashing.
  try {
    const item = await identifyItem(base64, photo.type as Allowed);
    const links = item.found ? buildShopLinks(item.searchQuery, item.category) : [];
    return NextResponse.json({ item, links });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Too many people at once. Try again in a few seconds." }, { status: 429 });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "The server's AI key is missing or wrong." }, { status: 500 });
    }
    console.error(err);
    return NextResponse.json({ error: "Something went wrong identifying that. Try another photo." }, { status: 500 });
  }
}
