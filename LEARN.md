# How SnapFind works (explained like you're 10)

## The big picture

Imagine a lemonade stand with three parts:

1. **The counter** where customers walk up. That's the **page** on your phone (`app/page.tsx`).
2. **The back room** where the work happens, which customers never see. That's the **server** (`app/api/identify/route.ts`).
3. **A really smart friend** you call on the phone from the back room. That's the **AI vision model** (`lib/identify.ts`).

Here's what happens when you snap a photo:

```
 Your phone (page.tsx)            Our server (route.ts)            The AI
 ─────────────────────            ─────────────────────            ───────────────
 1. You take a photo
 2. Shrink it to 1024px  ───────▶ 3. Check it's a real photo
                                  4. Turn it into text (base64)  ──▶ 5. "What is this?"
                                                                    6. Fills in our form
                                  7. Add store links  ◀──────────
 8. Show the answer  ◀───────────
```

## The files, one by one

### `app/page.tsx`: the screen you see

- **`"use client"`** at the top means "this code runs on the phone." It needs to, because only the phone can open the camera.
- **`useState`** is the app's memory. We remember four things: the photo, whether we're waiting, the answer, and any error. When one changes, React redraws the screen by itself, so we never have to say "now update the screen."
- **`shrinkPhoto`** draws your photo onto an invisible drawing board (a "canvas") at a smaller size, then saves it as a JPG. A phone photo can be 5 MB, and after shrinking it's about 100 KB. That's 50 times less to upload, so it feels much faster.
- **`<input type="file" capture="environment">`** is the magic button. On a phone it opens the back camera, and on a laptop it opens a file picker.
- **`fetch("/api/identify", ...)`** mails the photo to our server and waits for the reply.

### `app/api/identify/route.ts`: the back room

- **Why have a back room at all?** To use the AI you need a secret password called an **API key**. If we put it in the phone code, anyone could open the page's code, copy it, and run up our bill. The server keeps the key hidden.
- **`export async function POST`**: "POST" means "someone is sending us something." Whenever the phone sends a photo, this function runs.
- **The checks** (`No photo was sent`, `too big`, `wrong type`) are bouncers at the door. Never trust what comes from the internet.
- **`try { ... } catch { ... }`** means "try this, and if anything breaks, do this instead of crashing." We turn scary errors into friendly messages.

### `lib/identify.ts`: talking to the AI

- **The schema (`ItemSchema`)** is a fill-in-the-blanks form: name, brand, price, and so on. We tell the AI to answer *only* by filling in the form. Without it, the AI might answer "That looks like a cool Jordan 1!", and our code wouldn't know where the price is. With the form, `item.priceLow` is always a number.
- **`INSTRUCTIONS`** is the job description we give the AI every time.
- **`model: ...`** picks which AI model to use.
- **`effort: "low"`** tells the AI to answer quickly instead of thinking for a long time. Spotting a shoe is easy, and people hate waiting.
- **`fallbacks: "default"`** is a backup plan. If the AI ever refuses to answer, a backup model answers automatically.
- **base64** is a way to turn a picture into a long string of letters and numbers, so it can travel inside a text message to the AI.

### `lib/shopLinks.ts`: the "buy it" buttons

It takes the item's name and builds search links for Google Shopping, Amazon, and eBay. For sneakers and clothes, it also adds StockX and GOAT, the resale sites where hype stuff sells. `encodeURIComponent` makes text safe for a web address (a space becomes `%20`).

### The boring-but-needed files

| File | What it does |
|---|---|
| `package.json` | The shopping list of code libraries we use (Next.js, React, the Anthropic SDK, Zod), plus shortcut commands like `npm run dev`. |
| `tsconfig.json` | Settings for **TypeScript**, which is JavaScript with spell-check for your data. It yells at you *before* you run the code if you, say, treat a price like a word. |
| `app/layout.tsx` | The frame around every page: the title in the browser tab and the phone-size setting. |
| `app/globals.css` | Colors, sizes, the purple button, and the spinning loader. |
| `.env.example` | Shows which secret settings you need. Copy it to `.env.local` and put your real key in. |
| `.gitignore` | Files git should never upload, especially `.env.local` with your secret key. |

## Words to know

- **Frontend / client**: the part on your phone.
- **Backend / server**: the part on our computer.
- **API**: a way for programs to talk to each other. Our server's `/api/identify` is an API, and so is the AI service we call.
- **Next.js**: a toolkit that lets us write the frontend and backend in one project.
- **React**: the library that draws the screen and redraws it when state changes.
- **SDK**: a ready-made helper library for talking to a service (here, the AI service).

## Week 2: comparing prices (explained like you're 10)

### The big picture

Last week the app said "here are some stores, go check them yourself." Now the app **checks the stores for you**:

```
 1. The AI says "it's an Air Jordan 1 Chicago"
 2. The phone asks our server: /api/prices?q=Air Jordan 1 Chicago
 3. The server asks Google Shopping AND eBay at the same time
 4. Each answer gets turned into the same "price tag" shape (an Offer)
 5. The judge (bestDeal.ts) throws out junk and picks the winners
 6. The phone shows: Best new deal, Best used deal, and every offer
```

### The new files

**`lib/prices/types.ts`: the price tag.** Google and eBay describe prices in totally different ways. Google says `"delivery": "$5.99 delivery"`, while eBay says `"shippingCost": {"value": "5.99"}`. So we invented one price tag (`Offer`) and make every source fill it in. Then the rest of the app only has to read one kind of tag. This trick is called **normalizing** data, and it comes up a lot in interviews.

**`lib/prices/google.ts`: asking Google Shopping.** Google doesn't let apps read Shopping results directly, so a company called **SerpApi** does the search and sends back neat data. `parseShipping` reads text like "Free delivery" and turns it into a number. A **regular expression** (the `/\$\s?([\d,]+...)/` thing) is a pattern-matcher for text, kind of like "find a dollar sign followed by numbers."

**`lib/prices/ebay.ts`: asking eBay.** eBay's API is official and free, but it wants a **day pass** first. We trade our ID and secret for an **access token** that lasts about 2 hours. We save it (**caching**) and reuse it, instead of logging in before every single search.

**`lib/prices/bestDeal.ts`: the judge.** It has four rules:
1. **Throw out junk.** Search "Jordan 1" and you also get $9 shoelaces. We find the **median** (the middle price, where half are cheaper and half are pricier) and drop anything under 35% of it.
2. **Split new and used.** A used shoe isn't a fair fight against a new one.
3. **Only trusted sellers can win.** That means famous stores, 4+ star stores, or eBay sellers with 98%+ positive reviews from at least 50 buyers. Untrusted ones still show in the list, labeled "unverified seller," but they can't be picked as the best deal.
4. **Compare the total.** $150 + $15 shipping = $165, which loses to $160 with free shipping.

**`lib/prices/index.ts`: the manager.** It uses `Promise.allSettled` to ask every source **at the same time**. If Google takes 2 seconds and eBay takes 2 seconds, we wait 2 seconds total, not 4. And if eBay breaks, we still show Google's prices instead of crashing. That's called **graceful degradation**.

**`app/api/prices/route.ts`: the new door.** It's a separate door from `/api/identify` so the phone can show *what* the item is right away and fill in prices a moment later. Nobody stares at a blank screen.

**`lib/prices/prices.test.ts`: the robot checkers.** Ten tests make sure the judge follows its rules, for example "untrusted sellers never win" and "shipping counts." Run them with `npm test`. If you change the code and break a rule, a test turns red and tells you.

### New words

- **Normalize**: turn differently-shaped data into one shape.
- **Access token**: a temporary pass that proves you're allowed to use an API.
- **Cache**: saving an answer so you don't have to fetch it again.
- **Median**: the middle number when you line them all up.
- **Parallel requests**: asking several places at once instead of one by one.
- **Unit test**: a tiny automatic check for one piece of code.

## Week 3: instant repeats, history, and share cards

### Instant repeats: the app remembers

If 100 people snap the same hyped sneaker, why ask the AI 100 times? Now the server **remembers** answers.

**`lib/imageHash.ts`: a photo fingerprint.** We shrink the photo to a tiny 9x8 gray picture, so all the small details disappear. Then in each row we ask, "is this pixel brighter than the one to its right?" Yes = 1, no = 0. That gives 64 ones and zeros, the **fingerprint**. Two photos of the same thing get almost the same fingerprint, even if one is brighter or a different size.

To compare two fingerprints, we count how many of the 64 spots are different. That's the **Hamming distance**. 0 means identical. Our tests show slightly-changed copies land at 6 or under, and different pictures land above 20.

**`lib/cache.ts`: short-term memory with two rules.**
1. **Things expire.** AI answers last a week (a Jordan 1 is still a Jordan 1), but prices only last 30 minutes, since prices change.
2. **Limited space.** When it's full, it forgets whatever was used longest ago. That's called **LRU** (Least Recently Used). A JavaScript `Map` remembers the order things were added, so the oldest one is always first in line.

**`lib/memory.ts`: where the two memories live.** `identifyCache` maps photo fingerprints to AI answers, and `priceCache` maps search words to prices. `findSimilar` looks for a remembered fingerprint within 6 bits of the new one.

**Why it matters:** a remembered answer comes back instantly, shown with a ⚡ instant badge, and costs $0. Our full test proved it: we snapped the same photo twice and the AI was asked only once.

**Honest limit:** this catches the *same or almost-the-same photo*, like a re-upload or a slightly different shot. Recognizing "a different photo of the same shoe" needs an AI that turns pictures into number lists (called **embeddings**). That's a good future upgrade.

### History: a notebook in your browser

`localStorage` is a tiny notebook every browser gives each website. We save your last 20 snaps there: a 160px thumbnail, what it was, and the prices. No account or server needed. Tap an old snap and it reopens instantly. Everything is wrapped in `try/catch` because some browsers (like private mode) block the notebook, and then the app just skips history instead of crashing.

### Share cards: made for TikTok and Instagram

**`app/api/card/route.tsx`** draws a 1080x1350 picture that says "I snapped a photo and found ... $180 at Nike, saved $74." We describe it with the same HTML-style code as the page, and Next.js's `ImageResponse` turns it into a PNG. The **Share this find** button uses the phone's own share sheet (`navigator.share`), so you can send it straight to Instagram, TikTok, or Messages. On a computer it downloads the picture instead.

Every share is free advertising. That's how apps go viral: the thing people post *is* the ad.

### New words

- **Hash / fingerprint**: a short code that represents something bigger.
- **Hamming distance**: how many spots differ between two codes.
- **Cache**: saved answers you can reuse.
- **TTL (time to live)**: how long a saved answer stays valid.
- **LRU**: when full, forget the least recently used thing.
- **localStorage**: a small notebook the browser keeps for each website.
- **Embeddings**: a way to turn pictures or text into lists of numbers, so "similar" things end up with similar numbers.

## Weeks 4 and 5: making money and going public

### Affiliate links: how the app earns money (`lib/affiliate.ts`)

Amazon and eBay pay a small cut (about 1 to 4%) when someone buys through **your** link, and the buyer pays nothing extra. Your link is just the normal link with your ID on the end, like `?tag=yourname-20` for Amazon. `addAffiliate` adds the right ID to the right store's links. With no ID set up, links stay normal.

Two careful details:
- We check the store's address properly, so a fake address like `ebay.com.scam.test` doesn't get treated as eBay.
- US law (the FTC) says you must tell people when links can earn you money, so the app shows "SnapFind may earn a commission" whenever affiliate IDs are on. Links also get `rel="sponsored"`, which tells Google they're paid links.

### The bouncer: rate limiting (`lib/rateLimit.ts`)

Once the app is public, someone could send 10,000 photos and drain your AI credit. Each visitor (known by their internet address, the **IP**) gets a bucket that counts their tries: 30 photos an hour, 60 price checks an hour. When the bucket's full, they get a polite "slow down" message, and the bucket empties when the hour's up. Our test sent 31 photos from one address: the 31st was blocked, and a different visitor was fine.

### Demo mode (`lib/demo.ts`)

With no AI key yet, the app shows a clearly labeled **sample** result instead of an error. That means the live link works from day one. The sample prices still go through the real best-deal judge, so the demo shows the real logic.

### Usage tracking

`@vercel/analytics` counts visits, plus events we send with `track()`: **snap**, **deal_click**, **offer_click**, **store_link_click**, and **share**. That shows things like "how many snaps turn into a click?", which is called a **conversion rate**. It uses no cookies and collects no personal info.

### Going online

The **Deploy with Vercel** button in the README copies the project to Vercel, a free host, and asks for your keys. Every time new code lands on `main`, Vercel puts the new version online by itself. That's called **continuous deployment**.

**Honest limit:** our caches and rate limits live in the server's memory. Vercel can run several copies of the server, and each copy has its own memory, so a repeat photo might hit a copy that hasn't seen it yet. For a big launch we'd move them to a shared store like Redis. It's a good "how would you scale this?" interview answer.

### New words

- **Affiliate link**: a link with your ID that earns a commission on purchases.
- **Rate limit**: a cap on how often one visitor can do something.
- **IP address**: a device's address on the internet.
- **Conversion rate**: the share of people who take the next step (like snap, then click buy).
- **Continuous deployment**: new code goes live automatically.
- **Environment variables**: secret settings (like keys) kept outside the code.

## Installable app and type-it search

### Installable: a real app icon, no app store (`app/manifest.ts`)

The **manifest** is the app's ID card: its name, icon, colors, and "open me full screen." With it, phones offer **Add to Home Screen** (Android may say **Install app**), and SnapFind gets its own icon that opens without the browser bar, just like a store app. This kind of app is called a **PWA** (Progressive Web App).

The icons are drawn by `scripts/make-icons.mjs` from a small SVG drawing (shapes described with code), resized into every size phones ask for. The "maskable" one has extra padding, because Android sometimes crops icons into circles.

**Why not the Play Store yet?** Stores cost money ($25 once for Google, $99 a year for Apple) and days of review. A website link works for everyone today, and it's easier to share from a TikTok bio. If people love it, the same app can be wrapped for the stores later.

### Type it instead

The search box under the Snap button skips the photo and the AI and goes straight to price checks. That makes it **free to run**, since only the price sources are used. It reuses the same `/api/prices` door, which now also sends back store links. Typed searches show up in history with a letter instead of a photo.

### New words

- **PWA (Progressive Web App)**: a website that can be installed like an app.
- **Manifest**: the file that tells phones an app's name, icon, and colors.
- **SVG**: a picture described with code (shapes and lines), so it stays sharp at any size.

## Switching to a free AI (Gemini)

SnapFind can now use **two different AIs**, and picks one by itself:

1. `GEMINI_API_KEY` set? It uses **Google Gemini**, which has a free tier with no credit card.
2. `ANTHROPIC_API_KEY` set? It uses Anthropic's model, the paid option at about a cent per photo.
3. Neither? Demo mode.

**How the swap works without breaking anything:** both AIs fill in the exact same answer form (`lib/item.ts`). `lib/identify.ts` is a **switchboard**: it looks at which key exists and calls `lib/ai/gemini.ts` or `lib/ai/anthropic.ts`. Everything else in the app (prices, history, share cards) never knows or cares which AI answered. Writing code this way is called an **abstraction**, or a "provider interface." It's a classic interview topic: "how would you switch vendors without rewriting your app?"

**Inside `gemini.ts`:**
- `z.toJSONSchema(ItemSchema)` turns our form into **JSON Schema**, the standard format Gemini understands, so Gemini answers only in that shape.
- `ItemSchema.safeParse(...)` double-checks the answer anyway. Never fully trust data from outside your app.
- `gemini-flash-latest` always points to Google's newest fast model, so the app doesn't break when they retire an old one.

**`lib/ai/errors.ts`:** each company reports problems differently, so we translate them into two errors of our own: `AiBusyError` (too many requests, like hitting the free daily limit) and `AiKeyError` (bad key). The server route only has to handle those two.

**Free-tier trade-offs, honestly:** there are per-minute and per-day limits, and on the free tier Google may use what's sent to improve its models. Fine for building and an early launch. If it takes off, switch to a paid key.

### New words

- **Abstraction / provider interface**: one simple doorway in front of several different services.
- **JSON Schema**: a standard way to describe the shape of data.
- **Validation**: checking data is in the shape you expect before using it.

## What's honest about week 1

The price is the AI's **estimate** of the typical price, not a live price from a store. That's why it says "typical price." Week 2 (above) adds **real live prices**. The AI's estimate is still shown as "typical price" next to them.
