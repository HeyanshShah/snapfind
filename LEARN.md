# How SnapFind works (explained like you're 10)

## The big picture

Imagine a lemonade stand with three parts:

1. **The counter** where customers walk up. That's the **page** on your phone (`app/page.tsx`).
2. **The back room** where the work happens, which customers never see. That's the **server** (`app/api/identify/route.ts`).
3. **A really smart friend** you call on the phone from the back room. That's **Claude**, the AI (`lib/identify.ts`).

Here's what happens when you snap a photo:

```
 Your phone (page.tsx)            Our server (route.ts)            Claude (the AI)
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

- **Why have a back room at all?** To use Claude you need a secret password called an **API key**. If we put it in the phone code, anyone could open the page's code, copy it, and run up our bill. The server keeps the key hidden.
- **`export async function POST`**: "POST" means "someone is sending us something." Whenever the phone sends a photo, this function runs.
- **The checks** (`No photo was sent`, `too big`, `wrong type`) are bouncers at the door. Never trust what comes from the internet.
- **`try { ... } catch { ... }`** means "try this, and if anything breaks, do this instead of crashing." We turn scary errors into friendly messages.

### `lib/identify.ts`: talking to the AI

- **The schema (`ItemSchema`)** is a fill-in-the-blanks form: name, brand, price, and so on. We tell Claude to answer *only* by filling in the form. Without it, Claude might answer "That looks like a cool Jordan 1!", and our code wouldn't know where the price is. With the form, `item.priceLow` is always a number.
- **`INSTRUCTIONS`** is the job description we give Claude every time.
- **`model: "claude-opus-5-5"`** picks which AI to use.
- **`effort: "low"`** tells Claude to answer quickly instead of thinking for a long time. Spotting a shoe is easy, and people hate waiting.
- **`fallbacks: "default"`** is a backup plan. If the AI ever refuses to answer, a backup model answers automatically.
- **base64** is a way to turn a picture into a long string of letters and numbers, so it can travel inside a text message to the AI.

### `lib/shopLinks.ts`: the "buy it" buttons

It takes the item's name and builds search links for Google Shopping, Amazon, and eBay. For sneakers and clothes, it also adds StockX and GOAT, the resale sites where hype stuff sells. `encodeURIComponent` makes text safe for a web address (a space becomes `%20`).

### The boring-but-needed files

| File | What it does |
|---|---|
| `package.json` | The shopping list of code libraries we use (Next.js, React, the Claude SDK, Zod), plus shortcut commands like `npm run dev`. |
| `tsconfig.json` | Settings for **TypeScript**, which is JavaScript with spell-check for your data. It yells at you *before* you run the code if you, say, treat a price like a word. |
| `app/layout.tsx` | The frame around every page: the title in the browser tab and the phone-size setting. |
| `app/globals.css` | Colors, sizes, the purple button, and the spinning loader. |
| `.env.example` | Shows which secret settings you need. Copy it to `.env.local` and put your real key in. |
| `.gitignore` | Files git should never upload, especially `.env.local` with your secret key. |

## Words to know

- **Frontend / client**: the part on your phone.
- **Backend / server**: the part on our computer.
- **API**: a way for programs to talk to each other. Our server's `/api/identify` is an API, and so is Claude.
- **Next.js**: a toolkit that lets us write the frontend and backend in one project.
- **React**: the library that draws the screen and redraws it when state changes.
- **SDK**: a ready-made helper library for talking to a service (here, Claude).

## What's honest about week 1

The price is the AI's **estimate** of the typical price, not a live price from a store. That's why it says "typical price." In week 2 we'll fetch **real live prices** and build our own image search so repeat items are instant.
