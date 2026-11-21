# SnapFind

Point your camera at anything (sneakers, a car, a plant, an outfit) and find out what it is, what it costs, and where to buy it.

![SnapFind identifying a sneaker](docs/week2-screenshot.png)

New to the code? Start with **[LEARN.md](LEARN.md)**, which explains every file in plain English.

## Put it online (free)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FHeyanshShah%2Fsnapfind&env=GEMINI_API_KEY&envDescription=Free%20key%20for%20the%20photo%20recognition%20AI&envLink=https%3A%2F%2Faistudio.google.com)

Click the button, sign in with GitHub, paste your keys, and click Deploy. Without an AI key the app runs in **demo mode** and shows clearly labeled sample results. You can add more keys later under Project → Settings → Environment Variables (see `.env.example` for the full list).

## Run it on your computer

1. Install [Node.js](https://nodejs.org) (version 20 or newer).
2. Get a free Gemini API key at [aistudio.google.com](https://aistudio.google.com) (no credit card).
3. In this folder, run:

   ```bash
   npm install
   cp .env.example .env.local   # then open .env.local and paste your key
   npm run dev
   ```

4. Open http://localhost:3000 and snap something.

### Live prices (optional)

Without these keys the app still works, it just shows store links instead of live prices. Add them to `.env.local` (or to Vercel's Environment Variables):

- `SERPAPI_KEY`: Google Shopping results, from [serpapi.com](https://serpapi.com) (free tier available)
- `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET`: from [developer.ebay.com](https://developer.ebay.com) (free)

### Affiliate links (optional, this is how it makes money)

- `AMAZON_ASSOCIATE_TAG`: from [Amazon Associates](https://affiliate-program.amazon.com)
- `EBAY_CAMPAIGN_ID`: from [eBay Partner Network](https://partnernetwork.ebay.com)

Once set, buy links earn a commission and the app shows the required disclosure.

Run the tests with `npm test`.

## Roadmap

- [x] **Week 1:** snap, identify with AI, estimated price, store links
- [x] **Week 2:** live prices from Google Shopping and eBay, best new and used deal picker
- [x] **Week 3:** instant repeat lookups (photo fingerprints and caching), snap history, share cards
- [x] **Weeks 4–5:** affiliate links, usage analytics, rate limiting, demo mode, one-click deploy
- [x] **Installable app (PWA)** and a type-it-in search that works without the AI
- [ ] **Next:** go live, launch on TikTok, recognize different photos of the same product (image embeddings)
