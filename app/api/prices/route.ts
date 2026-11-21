// app/api/prices/route.ts
// The phone asks "/api/prices?q=Air Jordan 1 Chicago" and gets back every offer plus the
// best deal. It's separate from /api/identify so the app can show WHAT the item is right
// away, then fill in prices a moment later, instead of making you wait for both.

import { NextResponse } from "next/server";
import { getPrices, priceSourcesConfigured } from "@/lib/prices/index.ts";
import { buildShopLinks } from "@/lib/shopLinks";
import { affiliatesOn } from "@/lib/affiliate";
import { priceCache } from "@/lib/memory";
import { RateLimiter, visitorId } from "@/lib/rateLimit";
import { demoPrices } from "@/lib/demo";

// 60 price checks per visitor per hour (each one uses up free searches on the price sites).
const limiter = new RateLimiter(60, 60 * 60 * 1000);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "Missing search words." }, { status: 400 });
  if (q.length > 200) return NextResponse.json({ error: "Search is too long." }, { status: 400 });

  // Store links come back with the prices, so a typed search (no photo, no AI) gets them too.
  const extras = { links: buildShopLinks(q, params.get("category") ?? ""), affiliate: affiliatesOn() };

  // The demo photo result gets sample prices, but only when no real price keys are set up.
  if (params.get("demo") === "1" && !priceSourcesConfigured()) {
    return NextResponse.json({ ...demoPrices(), ...extras, demo: true });
  }

  const wait = limiter.check(visitorId(request));
  if (wait > 0) {
    return NextResponse.json({ error: "Too many price checks. Try again soon." }, { status: 429, headers: { "Retry-After": String(wait) } });
  }

  // Same search in the last 30 minutes? Reuse those prices instead of asking the stores again.
  // We lowercase and squish spaces so "Jordan 1" and "jordan  1" count as the same search.
  const key = q.toLowerCase().replace(/\s+/g, " ");
  const remembered = priceCache.get(key);
  if (remembered) return NextResponse.json({ ...remembered, ...extras, cached: true });

  try {
    const report = await getPrices(q);
    // Only remember answers where every source worked, so one hiccup isn't stuck for 30 min.
    if (report.configured && report.sourcesFailed.length === 0) priceCache.set(key, report);
    return NextResponse.json({ ...report, ...extras, cached: false });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Couldn't check prices right now." }, { status: 500 });
  }
}
