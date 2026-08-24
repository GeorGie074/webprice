/**
 * Find the correct Sony Store Thailand URL for WH-1000XM6
 * Usage: node test-sony-url.mjs
 */
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Set real browser headers
await page.setExtraHTTPHeaders({
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "th-TH,th;q=0.9,en;q=0.8",
});

console.log("🌐 Navigating to Sony Store homepage first (to get session cookies)...");
await page.goto("https://store.sony.co.th/th", { waitUntil: "domcontentloaded", timeout: 30000 });
console.log("   Homepage URL:", page.url());

// Try searching for the product
console.log("\n🔍 Searching for WH-1000XM6...");
await page.goto("https://store.sony.co.th/th/search?q=WH-1000XM6&type=product", { waitUntil: "domcontentloaded", timeout: 20000 });
console.log("   Search URL:", page.url());

// Get page text to see results
const text = await page.innerText("body").catch(() => "");
const lines = text.split("\n").filter(l => l.trim() && l.length < 200);
console.log("   Page snippet:", lines.slice(0, 20).join(" | "));

// Look for product links
const productLinks = await page.$$eval("a[href*='/products/']", links =>
  links.map(l => ({ text: l.innerText?.trim().slice(0, 60), href: l.href }))
       .filter(l => l.href.includes("1000xm6") || l.href.includes("wh-1000") || l.text.includes("1000XM6"))
);
console.log("\n📌 Product links found in search:", productLinks);

// Try direct product URL (various formats)
const urlsToTry = [
  "https://store.sony.co.th/th/products/wh-1000xm6",
  "https://store.sony.co.th/th/products/wh1000xm6",
  "https://store.sony.co.th/th/products/wh-1000xm6-lme",
  "https://store.sony.co.th/th/products/wh-1000xm6-bze",
  "https://store.sony.co.th/products/wh-1000xm6",
  "https://store.sony.co.th/th/collections/wh1000xm6",
];

console.log("\n🔗 Testing direct URLs:");
for (const url of urlsToTry) {
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => null);
  const status = resp ? resp.status() : "error";
  const finalUrl = page.url();
  const title = await page.title().catch(() => "");
  console.log(`  ${status === 200 ? "✅" : "❌"} ${status}  ${url}`);
  if (status === 200 && finalUrl !== url) console.log(`      → redirected to: ${finalUrl}`);
  if (status === 200) console.log(`      title: ${title}`);
}

await browser.close();
