// app/api/identify/route.ts
// This is our "server": code that runs on a computer we control, not on the user's phone.
// The phone sends a photo here, we ask the AI, and we send the answer back.
// Why not ask the AI straight from the phone? Because then we'd have to put our secret
// API key on the phone, and anyone could steal it. The server keeps it hidden.

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { identifyItem } from "@/lib/identify";
import { buildShopLinks } from "@/lib/shopLinks";
import { dHash } from "@/lib/imageHash";
import { identifyCache, findSimilar } from "@/lib/memory";
import { RateLimiter, visitorId } from "@/lib/rateLimit";
import { demoMode, DEMO_ITEM } from "@/lib/demo";
import { affiliatesOn } from "@/lib/affiliate";

// Each visitor gets 30 photo checks per hour. Plenty for real people, but it stops
// anyone from spamming the AI and burning through your credit.
const limiter = new RateLimiter(30, 60 * 60 * 1000);

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type Allowed = (typeof ALLOWED)[number];

// Photos bigger than this get rejected, so nobody can clog our server.
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// "POST" means "the phone is sending us something" (the photo).
export async function POST(request: Request) {
  // 0. The bouncer: too many photos from this visitor lately? Ask them to wait.
  const wait = limiter.check(visitorId(request));
  if (wait > 0) {
    return NextResponse.json(
      { error: `Whoa, slow down! Try again in ${Math.ceil(wait / 60)} min.` },
      { status: 429, headers: { "Retry-After": String(wait) } },
    );
  }

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

  // No AI key yet? Show a clearly labeled sample answer so the app still demos well.
  if (demoMode()) {
    return NextResponse.json({ item: DEMO_ITEM, links: buildShopLinks(DEMO_ITEM.searchQuery, DEMO_ITEM.category), demo: true, affiliate: affiliatesOn() });
  }

  const bytes = Buffer.from(await photo.arrayBuffer());

  // 2. Make the photo's fingerprint. Have we seen this photo (or one almost like it) before?
  //    If so, answer instantly from memory: no waiting, and no paying the AI again.
  let hash: string | null = null;
  try {
    hash = await dHash(bytes);
    const remembered = findSimilar(hash);
    if (remembered) {
      const links = remembered.found ? buildShopLinks(remembered.searchQuery, remembered.category) : [];
      return NextResponse.json({ item: remembered, links, cached: true, affiliate: affiliatesOn() });
    }
  } catch {
    // If fingerprinting fails (weird file), just skip the shortcut and ask the AI.
  }

  // 3. Turn the photo into base64 text so it can be sent to the AI.
  const base64 = bytes.toString("base64");

  // 4. Ask the AI, and catch problems so the app shows a friendly message instead of crashing.
  try {
    const item = await identifyItem(base64, photo.type as Allowed);
    // Only remember real products. A blurry "nothing found" photo isn't worth remembering.
    if (hash && item.found) identifyCache.set(hash, item);
    const links = item.found ? buildShopLinks(item.searchQuery, item.category) : [];
    return NextResponse.json({ item, links, cached: false, affiliate: affiliatesOn() });
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
