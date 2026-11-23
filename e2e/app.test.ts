// e2e/app.test.ts
// "End-to-end" tests: a robot opens the real app in a real (invisible) browser and uses it
// like a person would: typing, tapping, uploading a photo. If a button breaks, this fails.
//
// It runs the app with NO keys, so it's in demo mode: no AI calls and no money spent.
// Run it with: npm run build && npm run e2e

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright";

const PORT = 3123;
const URL = `http://localhost:${PORT}`;
let server: ChildProcess;
let browser: Browser;

// Before the tests: start the app (with every key removed) and open the browser.
before(async () => {
  const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(PORT) };
  // Blank keys (not missing ones) also win over a .env.local file, so tests never spend money.
  for (const key of ["GEMINI_API_KEY", "ANTHROPIC_API_KEY", "SERPAPI_KEY", "EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"]) env[key] = "";
  server = spawn("npx", ["next", "start", "-p", String(PORT)], { env, stdio: "ignore" });

  // Keep knocking until the app answers (up to 30 seconds).
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(URL)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  server?.kill();
});

// Opens a fresh page, like a brand-new visitor (empty history).
async function visit(): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(URL);
  return page;
}

test("home screen shows the search bar and example searches", async () => {
  const page = await visit();
  assert.equal(await page.getAttribute("h1 span", "aria-label"), "Find anything."); // the word animation keeps the real words here
  assert.equal(await page.locator(".chip").count(), 4);
  await page.close();
});

test("typing a product shows store links and saves it to Recent", async () => {
  const page = await visit();
  await page.fill(".searchbar input", "PS5 Slim");
  await page.click(".go");
  await page.waitForSelector(".store");
  assert.equal(await page.textContent(".info h2"), "PS5 Slim");
  assert.ok((await page.locator(".store").count()) >= 3, "should show at least 3 store links");
  // Store links must open in a new tab and be marked as possibly earning money.
  assert.match(await page.getAttribute(".store", "rel") ?? "", /sponsored/);

  // Reload the page: the search should still be in Recent (saved in the browser).
  await page.reload();
  assert.equal(await page.textContent(".history-name"), "PS5 Slim");
  await page.close();
});

test("tapping an example search runs it", async () => {
  const page = await visit();
  await page.click(".chip >> text=AirPods Pro 2");
  await page.waitForSelector(".store");
  assert.equal(await page.textContent(".info h2"), "AirPods Pro 2");
  await page.close();
});

test("snapping a photo in demo mode shows the labeled sample result", async () => {
  const page = await visit();
  await page.setInputFiles(".searchbar input[type=file]", "e2e/photo.jpg");
  await page.waitForSelector(".banner");
  assert.match(await page.textContent(".banner") ?? "", /Demo mode/);
  await page.waitForSelector(".deal"); // demo mode also shows sample prices
  assert.match(await page.textContent(".deal-price") ?? "", /^\$\d/);
  await page.close();
});

test("New search goes back to the home screen", async () => {
  const page = await visit();
  await page.click(".chip >> text=PS5 Slim");
  await page.waitForSelector(".store");
  await page.click("text=New search");
  await page.waitForSelector("h1");
  assert.equal(await page.inputValue(".searchbar input"), "");
  await page.close();
});

test("Watch price adds the item to Watching, it survives a reload, and × removes it", async () => {
  const page = await visit();
  await page.click(".chip >> text=Jordan 1 Chicago");
  await page.waitForSelector(".store");
  await page.click("text=Watch price");
  assert.equal(await page.textContent("[aria-pressed=true]"), " Watching price");
  await page.reload(); // back on the home screen, the watch list is still there
  assert.equal(await page.textContent(".watching .history-name"), "Jordan 1 Chicago");
  await page.click(".unwatch");
  assert.equal(await page.locator(".watching").count(), 0);
  await page.close();
});

test("a cheaper price on the next visit shows a Price drop banner", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  // Pretend we started watching yesterday at $999 and haven't checked since.
  // Demo mode answers with sample prices (well under $999), so it should count as a drop.
  await page.addInitScript(() => {
    if (localStorage.getItem("snapfind-watch")) return; // only seed on the first load
    localStorage.setItem("snapfind-watch", JSON.stringify([{
      id: "w1", name: "Sample sneaker", query: "Air Jordan 1 Chicago", category: "sneakers", thumb: "", demo: true,
      addedAt: 0, startPrice: 999, price: 999, store: "Old store", url: "https://example.com", lowest: 999, checkedAt: 0,
    }]));
  });
  await page.goto(URL);
  await page.waitForSelector(".drop");
  assert.match(await page.textContent(".drop") ?? "", /Price drop! Sample sneaker is now \$\d+/);
  assert.match(await page.textContent(".watching .down") ?? "", /↓ \$\d+/);
  await page.close();
});
