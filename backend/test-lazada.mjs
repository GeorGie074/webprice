/**
 * Quick test: run Lazada scraper directly to see what Lazada returns for a keyword.
 * Usage (from backend dir): node --experimental-vm-modules test-lazada.mjs
 *
 * NOTE: Uses headless:false + off-screen window (same as prod scraper).
 */
import { chromium } from "playwright";

const keyword = process.argv[2] || "iPad Air M2";
console.log(`\n🔍 Testing Lazada search: "${keyword}"\n`);

const browser = await chromium.launch({
  headless: false,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
    "--window-size=1366,768",
    "--window-position=-8000,-8000",
    "--lang=th-TH",
  ],
  ignoreDefaultArgs: ["--enable-automation"],
});

const context = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  locale: "th-TH",
  timezoneId: "Asia/Bangkok",
  viewport: { width: 1366, height: 768 },
  extraHTTPHeaders: {
    "accept-language": "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7",
  },
});
await context.addInitScript(`
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
  Object.defineProperty(navigator, 'languages', { get: () => ['th-TH','th','en-US','en'] });
  window.chrome = { runtime: {}, loadTimes: function(){}, csi: function(){}, app: {} };
`);

const page = await context.newPage();
const results = [];

// Visit homepage first
console.log("[1] Visiting homepage for cookies...");
await page.goto("https://www.lazada.co.th/", { waitUntil: "domcontentloaded", timeout: 25000 });
await page.waitForTimeout(1500);

const searchUrl = `https://www.lazada.co.th/catalog/?q=${encodeURIComponent(keyword)}&sort=popularity`;

// Set up AJAX interceptor
const apiWaiter = page.waitForResponse(
  (resp) =>
    resp.url().includes("lazada.co.th/catalog") &&
    resp.url().includes("ajax=true") &&
    resp.status() === 200,
  { timeout: 20000 }
).catch(() => {
  console.log("[AJAX] No AJAX response intercepted (timeout)");
  return null;
});

// Navigate to search
console.log(`[2] Navigating to search: "${keyword}"...`);
await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

// Scroll
for (let y = 0; y <= 1500; y += 300) {
  await page.evaluate((sy) => window.scrollTo(0, sy), y);
  await page.waitForTimeout(400);
}

// Wait for AJAX
const apiResp = await apiWaiter;
if (apiResp) {
  try {
    const data = await apiResp.json();
    const items = data?.mods?.listItems ?? [];
    console.log(`\n✅ AJAX captured ${items.length} items!\n`);
    items.slice(0, 12).forEach((item, i) => {
      const price = parseFloat(String(item.price ?? item.priceShow ?? "0").replace(/[^0-9.]/g, ""));
      console.log(`  [${i}] ฿${price.toLocaleString()} "${(item.name ?? "").slice(0, 80)}"`);
    });
    if (items.length === 0) {
      console.log("  (no items in API response — checking DOM fallback)");
    }
  } catch (e) {
    console.log("[AJAX] JSON parse failed:", e.message);
  }
}

// Always check DOM too (covers AJAX-0-items case)
{
  await page.waitForTimeout(2000);
  const title = await page.title().catch(() => "?");
  console.log(`\n  [DOM] Page title: "${title.slice(0, 80)}"`);

  const domItems = await page.evaluate(() => {
    const selectors = [
      '[data-tracking="product-card"]',
      ".Bm3ON",
      '[class*="product-card"]',
      "div[data-item-id]",
    ];
    for (const sel of selectors) {
      const found = Array.from(document.querySelectorAll(sel));
      if (found.length > 0) {
        return found.slice(0, 5).map((el) => ({
          sel,
          text: el.innerText?.split("\n").filter(Boolean).slice(0, 3).join(" | "),
        }));
      }
    }
    return [];
  }).catch(() => []);

  if (domItems.length > 0) {
    console.log(`  DOM found ${domItems.length} items (selector: ${domItems[0].sel}):`);
    domItems.forEach((it, i) => console.log(`    [${i}] ${it.text?.slice(0, 100)}`));
  } else {
    console.log("  DOM: 0 items found");
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 300)).catch(() => "");
    console.log("  Body snippet:", bodyText);
  }
}

await context.close().catch(() => {});
await browser.close().catch(() => {});
console.log("\n✅ Done");
