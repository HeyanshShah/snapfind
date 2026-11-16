// app/api/prices/route.ts
// The phone asks "/api/prices?q=Air Jordan 1 Chicago" and gets back every offer plus the
// best deal. It's separate from /api/identify so the app can show WHAT the item is right
// away, then fill in prices a moment later, instead of making you wait for both.

import { NextResponse } from "next/server";
import { getPrices } from "@/lib/prices/index.ts";
import { priceCache } from "@/lib/memory";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "Missing search words." }, { status: 400 });
  if (q.length > 200) return NextResponse.json({ error: "Search is too long." }, { status: 400 });

  // Same search in the last 30 minutes? Reuse those prices instead of asking the stores again.
  // We lowercase and squish spaces so "Jordan 1" and "jordan  1" count as the same search.
  const key = q.toLowerCase().replace(/\s+/g, " ");
  const remembered = priceCache.get(key);
  if (remembered) return NextResponse.json({ ...remembered, cached: true });

  try {
    const report = await getPrices(q);
    // Only remember answers where every source worked, so one hiccup isn't stuck for 30 min.
    if (report.configured && report.sourcesFailed.length === 0) priceCache.set(key, report);
    return NextResponse.json({ ...report, cached: false });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Couldn't check prices right now." }, { status: 500 });
  }
}
