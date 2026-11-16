// lib/affiliate.ts
// How SnapFind makes money. Stores like Amazon and eBay run "affiliate programs":
// if someone clicks YOUR special link and buys, the store pays you a small cut
// (usually 1-4%) and the buyer pays nothing extra.
//
// The "special link" is just the normal link with your ID stuck on the end.
// This file sticks the right ID on the right links. No ID set up yet? Links stay normal.

export function addAffiliate(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url; // not a real web address, leave it alone
  }
  const host = u.hostname.toLowerCase();

  // Amazon Associates: add ?tag=your-id-20
  const amazonTag = process.env.AMAZON_ASSOCIATE_TAG;
  if (amazonTag && (host === "amazon.com" || host.endsWith(".amazon.com"))) {
    u.searchParams.set("tag", amazonTag);
    return u.toString();
  }

  // eBay Partner Network: eBay's standard tracking settings, plus your campaign ID.
  const ebayCampaign = process.env.EBAY_CAMPAIGN_ID;
  if (ebayCampaign && (host === "ebay.com" || host.endsWith(".ebay.com"))) {
    u.searchParams.set("mkcid", "1");
    u.searchParams.set("mkrid", "711-53200-19255-0"); // means "eBay US"
    u.searchParams.set("siteid", "0");
    u.searchParams.set("campid", ebayCampaign);
    u.searchParams.set("toolid", "10001");
    u.searchParams.set("mkevt", "1");
    return u.toString();
  }

  return url;
}

// True when at least one affiliate program is set up, so the app knows to show the
// "we may earn a commission" note. US law (the FTC) says you must tell people.
export function affiliatesOn(): boolean {
  return Boolean(process.env.AMAZON_ASSOCIATE_TAG || process.env.EBAY_CAMPAIGN_ID);
}
