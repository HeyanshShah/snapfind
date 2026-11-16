# SnapFind

Point your camera at anything (sneakers, a car, a plant, an outfit) and find out what it is, what it costs, and where to buy it.

![SnapFind identifying a sneaker](docs/week1-screenshot.png)

New to the code? Start with **[LEARN.md](LEARN.md)**, which explains every file in plain English.

## Run it on your computer

1. Install [Node.js](https://nodejs.org) (version 20 or newer).
2. Get a Claude API key at [platform.claude.com](https://platform.claude.com).
3. In this folder, run:

   ```bash
   npm install
   cp .env.example .env.local   # then open .env.local and paste your key
   npm run dev
   ```

4. Open http://localhost:3000 and snap something.

## Roadmap

- [x] **Week 1:** snap, identify with AI, estimated price, store links
- [ ] **Weeks 2–3:** live prices, our own image search index for instant repeat lookups, history, share cards
- [ ] **Weeks 4–5:** affiliate links, analytics, launch
