// lib/prices/types.ts
// One "Offer" = one store selling the item. Every price source (Google Shopping, eBay...)
// turns its own messy data into this same simple shape, so the rest of the app only
// has to understand ONE shape. It's like every store filling in the same price tag.

export type Condition = "new" | "used";

export type Offer = {
  source: "google" | "ebay"; // which price source found it
  store: string; // who is selling it, e.g. "Nike", "Foot Locker", or an eBay seller
  title: string; // the listing's name
  price: number; // item price in US dollars
  shipping: number | null; // shipping cost in dollars (0 = free, null = we don't know)
  total: number; // price + shipping: what you actually pay
  condition: Condition;
  url: string; // where to buy it
  image: string | null; // a little picture of the listing
  rating: number | null; // store rating out of 5 (null = unknown)
  trusted: boolean; // do we trust this seller? (worked out in each source file)
};
