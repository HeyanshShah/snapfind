// app/api/prices/route.ts
// The phone asks "/api/prices?q=Air Jordan 1 Chicago" and gets back every offer plus the
// best deal. It's separate from /api/identify so the app can show WHAT the item is right
// away, then fill in prices a moment later, instead of making you wait for both.

import { NextResponse } from "next/server";
import { getPrices } from "@/lib/prices/index.ts";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "Missing search words." }, { status: 400 });
  if (q.length > 200) return NextResponse.json({ error: "Search is too long." }, { status: 400 });

  try {
    return NextResponse.json(await getPrices(q));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Couldn't check prices right now." }, { status: 500 });
  }
}
