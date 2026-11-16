// lib/rateLimit.ts
// Once the app is public, anyone could write a script that sends 10,000 photos and burns
// through your AI credit in minutes. A "rate limit" is a bouncer that says:
// "each visitor gets N tries per hour, then wait."
//
// How it works: each visitor (identified by their internet address, the "IP") gets a
// bucket that counts their requests. The bucket empties itself every `windowMs`.

export class RateLimiter {
  private buckets = new Map<string, { count: number; resetAt: number }>();
  private limit: number;
  private windowMs: number;
  private now: () => number;

  constructor(limit: number, windowMs: number, now: () => number = Date.now) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
  }

  // Returns how many seconds to wait, or 0 if this request is allowed.
  check(visitor: string): number {
    const t = this.now();
    const bucket = this.buckets.get(visitor);
    if (!bucket || t >= bucket.resetAt) {
      this.buckets.set(visitor, { count: 1, resetAt: t + this.windowMs });
      this.cleanup(t);
      return 0;
    }
    if (bucket.count >= this.limit) return Math.ceil((bucket.resetAt - t) / 1000);
    bucket.count++;
    return 0;
  }

  // Throw away old buckets now and then, so memory doesn't fill up with past visitors.
  private cleanup(t: number) {
    if (this.buckets.size < 10_000) return;
    for (const [key, b] of this.buckets) if (t >= b.resetAt) this.buckets.delete(key);
  }
}

// Works out who's asking. Hosting services like Vercel put the visitor's real address in
// the "x-forwarded-for" header (the first one in the list is the visitor).
export function visitorId(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}
