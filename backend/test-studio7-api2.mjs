/**
 * Studio 7 — capture request headers + raw response from inside browser session.
 * Usage: node test-studio7-api2.mjs "iPhone 16"
 */
import { chromium } from "playwright";
const keyword = process.argv[2] || "iPhone 16";

const browser = await chromium.launch({
  headless: false,
  args: ["--no-sandbox", "--disable-blink-features=AutomationControlled",
         "--window-size=1366,768", "--window-position=100,100"],
  ignoreDefaultArgs: ["--enable-automation"],
});
const ctx = await browser.newContext({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  locale: "th-TH", timezoneId: "Asia/Bangkok", viewport: { width: 1366, height: 768 },
});
const page = await ctx.newPage();

// Intercept product-groups request to see headers + full response
let productGroupsData = null;
let capturedReqHeaders = null;

page.on("response", async (resp) => {
  const url = resp.url();
  if (!url.includes("product-groups")) return;
  console.log(`\n🎯 Captured: ${url.slice(0, 120)}`);
  console.log(`   Status: ${resp.status()}`);
  // Capture response headers
  const rh = resp.headers();
  console.log(`   Content-Type: ${rh["content-type"]}`);
  try {
    const data = await resp.json();
    const items = data?.data?.items ?? [];
    console.log(`   Items: ${items.length}`);
    if (items.length > 0) {
      productGroupsData = items;
      console.log(`   Keys: ${Object.keys(items[0]).join(", ")}`);
      for (const item of items.slice(0, 3)) {
        console.log(`\n   ── Item ──`);
        console.log(`   name_th:        ${item.name_th ?? item.name ?? "(no name)"}`);
        console.log(`   name_en:        ${item.name_en ?? ""}`);
        console.log(`   price:          ${item.primary_product_price}`);
        console.log(`   slug:           ${item.product_group_slug}`);
        console.log(`   primary slug:   ${item.primary_product_slug}`);
        console.log(`   sku:            ${item.primary_product_sku}`);
        // Print ALL keys
        const allEntries = Object.entries(item);
        console.log(`   ALL: ${allEntries.map(([k,v]) => `${k}=${JSON.stringify(v)}`).join(" | ").slice(0, 300)}`);
      }
    }
  } catch (e) {
    console.log(`   Parse error: ${e.message}`);
    const raw = await resp.text().catch(() => "");
    console.log(`   Raw (200 chars): ${raw.slice(0, 200)}`);
  }
});

// Also intercept request to capture auth headers
page.on("request", (req) => {
  const url = req.url();
  if (!url.includes("product-groups")) return;
  capturedReqHeaders = req.headers();
  console.log(`\n📤 Request headers for product-groups:`);
  for (const [k, v] of Object.entries(capturedReqHeaders)) {
    if (k.toLowerCase() !== "user-agent") // skip UA (too long)
      console.log(`   ${k}: ${v.slice(0, 80)}`);
  }
});

const searchUrl = `https://www.studio7thailand.com/th/search?q=${encodeURIComponent(keyword)}`;
console.log(`\n[Studio7] Navigating: ${searchUrl}\n`);
await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 35_000 });
await page.waitForTimeout(4000);

for (let y = 0; y <= 1500; y += 400) {
  await page.evaluate(y => window.scrollTo(0, y), y).catch(() => {});
  await page.waitForTimeout(300);
}
await page.waitForTimeout(2000);

if (!productGroupsData) {
  console.log("\n⚠️  product-groups API not captured — check DOM fallback");
  const dom = await page.evaluate(() => {
    const cards = document.querySelectorAll("[class*='product'],[class*='ProductCard'],[class*='item']");
    return Array.from(cards).slice(0,5).map(c => ({
      classes: c.className?.slice(0,60),
      text: c.textContent?.trim().slice(0, 80),
    }));
  });
  console.log("DOM fallback:", dom);
}

console.log(`\nFinal URL: ${page.url()}`);
await ctx.close();
await browser.close();
