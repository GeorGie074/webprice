/**
 * Browse Sony Store collections to find WH-1000XM6 product URL
 */
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setExtraHTTPHeaders({
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
});

// Visit homepage first
await page.goto("https://store.sony.co.th/th", { waitUntil: "domcontentloaded", timeout: 30000 });

// Try headphones collection
console.log("🎧 Trying headphones collections...");
const collUrls = [
  "https://store.sony.co.th/th/collections/headphones",
  "https://store.sony.co.th/th/collections/audio",
  "https://store.sony.co.th/th/collections/all",
];

for (const url of collUrls) {
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => null);
  const status = resp?.status() ?? "error";
  console.log(`\n${status === 200 ? "✅" : "❌"} ${status} ${url}`);
  if (status === 200) {
    // Get all product links
    const links = await page.$$eval("a[href*='/products/']", els =>
      [...new Set(els.map(e => e.href))].slice(0, 30)
    );
    console.log("  Product links:", links.join("\n  "));

    // Search for XM6
    const xm6 = links.filter(l => l.toLowerCase().includes("xm6") || l.toLowerCase().includes("1000"));
    if (xm6.length) console.log("  🎯 XM6 matches:", xm6);
  }
}

// Try Shopify Ajax search
console.log("\n\n🔍 Trying Shopify Ajax search API...");
const ajaxResp = await page.goto(
  "https://store.sony.co.th/search?type=product&q=XM6&view=ajax",
  { waitUntil: "domcontentloaded", timeout: 10000 }
).catch(() => null);
const ajaxText = await page.content().catch(() => "");
console.log("Ajax response (first 500 chars):", ajaxText.slice(0, 500));

// Try products.json
console.log("\n\n📦 Trying products.json...");
await page.goto("https://store.sony.co.th/products.json?limit=10", { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => {});
const prodText = await page.content().catch(() => "");
console.log("products.json (first 500 chars):", prodText.slice(0, 500));

await browser.close();
