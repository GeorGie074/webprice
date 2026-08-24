/**
 * Check www.sony.co.th for WH-1000XM6 product page and buy URL
 */
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setExtraHTTPHeaders({
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "th-TH,th;q=0.9",
});

console.log("🌐 Loading www.sony.co.th WH-1000XM6 product page...");
await page.goto("https://www.sony.co.th/th/headphones/products/wh-1000xm6", {
  waitUntil: "domcontentloaded",
  timeout: 30000
});

const url = page.url();
const title = await page.title();
console.log("   URL:", url);
console.log("   Title:", title);

// Check for price
const bodyText = await page.innerText("body").catch(() => "");
const priceMatch = bodyText.match(/\d{2,3},?\d{3}(\.\d{2})?\s*(บาท|THB|฿)/);
console.log("   Price found:", priceMatch ? priceMatch[0] : "none");

// Find buy/cart buttons and their hrefs
const buyLinks = await page.$$eval(
  "a[href], button",
  els => els
    .filter(el => {
      const text = el.textContent?.toLowerCase() || "";
      const href = el.getAttribute("href") || "";
      return text.includes("ซื้อ") || text.includes("ตะกร้า") || text.includes("buy") ||
             text.includes("shop") || text.includes("สั่งซื้อ") || href.includes("buy");
    })
    .map(el => ({
      text: el.textContent?.trim().slice(0, 50),
      href: el.getAttribute("href") || "",
      tag: el.tagName
    }))
    .slice(0, 10)
);
console.log("\n🛒 Buy/Cart buttons:", JSON.stringify(buyLinks, null, 2));

// Look for price and store mentions
const lines = bodyText.split("\n")
  .map(l => l.trim())
  .filter(l => l && l.length < 200)
  .filter(l => /ราคา|price|฿|บาท|ซื้อ|buy|shop|cart|ตะกร้า|15,990|10,990|store/i.test(l))
  .slice(0, 20);
console.log("\n📋 Relevant content lines:", lines.join("\n"));

await browser.close();
