// lib/shopLinks.ts
// Turns the item's name into "Buy it here" links for different stores.
// Every link goes through addAffiliate, so purchases can earn a commission.

import { addAffiliate } from "./affiliate.ts";

export type ShopLink = { store: string; url: string };

export function buildShopLinks(searchQuery: string, category: string): ShopLink[] {
  // encodeURIComponent makes text safe to put in a web address
  // (for example, a space becomes %20).
  const q = encodeURIComponent(searchQuery);

  const links: ShopLink[] = [
    { store: "Google Shopping", url: `https://www.google.com/search?tbm=shop&q=${q}` },
    { store: "Amazon", url: `https://www.amazon.com/s?k=${q}` },
    { store: "eBay", url: `https://www.ebay.com/sch/i.html?_nkw=${q}` },
  ];

  // Sneakers and streetwear get resale sites too, because that's where hype items sell.
  const c = category.toLowerCase();
  if (/(sneaker|shoe|streetwear|hoodie|jacket|apparel|clothing)/.test(c)) {
    links.push({ store: "StockX", url: `https://stockx.com/search?s=${q}` });
    links.push({ store: "GOAT", url: `https://www.goat.com/search?query=${q}` });
  }

  return links.map((l) => ({ ...l, url: addAffiliate(l.url) }));
}
