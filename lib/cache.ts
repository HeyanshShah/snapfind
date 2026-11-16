// lib/cache.ts
// A cache is a short-term memory. If someone asks the same question twice, we answer
// from memory instead of paying the AI or the price sites again. That's faster AND cheaper.
//
// This cache has two rules:
// 1. Answers expire after a while (prices change, so a 3-day-old price is a lie).
// 2. It only remembers the most recent `maxItems` things, so it can't eat all the memory.
//    When it's full, it forgets whatever was used longest ago. That rule is called "LRU",
//    short for "Least Recently Used".

export class TtlCache<V> {
  // A Map remembers the order things were added. We use that order to know what's oldest.
  private items = new Map<string, { value: V; expiresAt: number }>();

  private maxItems: number;
  private ttlMs: number; // "time to live" in milliseconds
  private now: () => number; // the clock. Tests swap in a fake one so they can time-travel.

  constructor(maxItems: number, ttlMs: number, now: () => number = Date.now) {
    this.maxItems = maxItems;
    this.ttlMs = ttlMs;
    this.now = now;
  }

  get(key: string): V | undefined {
    const hit = this.items.get(key);
    if (!hit) return undefined;
    if (this.now() > hit.expiresAt) {
      this.items.delete(key); // too old, forget it
      return undefined;
    }
    // Move it to the back of the line: it was just used, so it's "recent" again.
    this.items.delete(key);
    this.items.set(key, hit);
    return hit.value;
  }

  set(key: string, value: V): void {
    this.items.delete(key);
    this.items.set(key, { value, expiresAt: this.now() + this.ttlMs });
    // Too full? Forget the oldest one (the first key in the Map).
    while (this.items.size > this.maxItems) {
      const oldest = this.items.keys().next().value as string;
      this.items.delete(oldest);
    }
  }

  // Look through everything still fresh. Used for "find a photo that looks similar".
  *entries(): Generator<[string, V]> {
    const t = this.now();
    for (const [key, hit] of this.items) {
      if (t <= hit.expiresAt) yield [key, hit.value];
    }
  }

  get size(): number {
    return this.items.size;
  }
}
