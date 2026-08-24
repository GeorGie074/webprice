/**
 * Smoke test: verify BNN scraper works end-to-end for two products.
 * Usage: node test-bnn-smoke.mjs
 */
import { chromium } from "playwright";

const TESTS = [
  { keyword: "MacBook Air M4",          path: "/p/apple/apple-mac" },
  { keyword: "iPhone 16 128GB",         path: "/p/apple/iphone/iphone-16" },
  { keyword: "Sony WH-1000XM5",         path: "/p/audio/sony" },
  { keyword: "ASUS ROG Zephyrus G14",   path: "/p/notebook/asus" },
  { keyword: "iPad Air M3",             path: "/p/apple/apple-ipad" },
];

const browser = await chromium.launch({
  headless: false,
  args: [
    "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
    "--window-size=1366,768", "--window-position=-8000,-8000", "--lang=th-TH",
  ],
  ignoreDefaultArgs: ["--enable-automation"],
});
const ctx = await browser.newContext({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  locale: "th-TH", timezoneId: "Asia/Bangkok", viewport: { width: 1366, height: 768 },
  extraHTTPHeaders: { "accept-language": "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7" },
});
await ctx.addInitScript(`Object.defineProperty(navigator,'webdriver',{get:()=>undefined});`);
const page = await ctx.newPage();

// Warm up homepage once
console.log("[warmup] Loading homepage...");
await page.goto("https://www.bnn.in.th/th", { waitUntil: "domcontentloaded", timeout: 25_000 });
await page.waitForTimeout(1500);

let totalPass = 0, totalFail = 0;

for (const { keyword, path } of TESTS) {
  const url = `https://www.bnn.in.th${path}`;
  console.log(`\n${"─".repeat(60)}`);
  console.log(`[test] "${keyword}" → ${path}`);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
  for (let y = 0; y <= 1500; y += 300) {
    await page.evaluate((s) => window.scrollTo(0, s), y);
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1000);

  const raw = await page.evaluate(() => {
    const normalize = (s) =>
      s.toLowerCase().replace(/[^a-z0-9฀-๿]/g, " ").split(/\s+/).filter(Boolean);

    const cards = Array.from(document.querySelectorAll('[class*="product-item"]'))
      .filter((el) => el.innerText.includes("฿"));

    const seen = new Set();
    const results = [];
    for (const el of cards) {
      const text = el.innerText;
      const priceMatch = text.match(/฿\s*([\d,]+)/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, "")) : 0;
      const lines = text.split("\n").map((l) => l.trim()).filter(
        (l) => l.length > 8 && !l.match(/^[A-Z\s&]+$/) && !l.includes("฿") &&
               !l.includes("ประหยัดไป") && !l.includes("หน้าหลัก") &&
               !l.includes("สินค้าหมด") && !l.match(/^\d+$/)
      );
      const name = lines[0] || "";
      const inStock = !text.includes("สินค้าหมด");

      let link = "";
      let node = el;
      for (let i = 0; i < 8; i++) {
        if (node.href) { link = node.href; break; }
        if (node.parentElement) node = node.parentElement;
        else break;
      }
      if (!link) link = (el.querySelector("a"))?.href || "";

      if (!price || !name) continue;
      const key = link || `${name}::${price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ name, price, url: link, inStock });
    }
    return results;
  });

  if (raw.length === 0) {
    console.log(`  ❌ No products found`);
    totalFail++;
    continue;
  }

  totalPass++;
  console.log(`  ✅ ${raw.length} products scraped`);
  raw.slice(0, 3).forEach((p, i) => {
    console.log(`  [${i}] ฿${p.price.toLocaleString()} | inStock=${p.inStock} | "${p.name.slice(0, 60)}"`);
    console.log(`       ${p.url.slice(0, 80)}`);
  });
}

await ctx.close();
await browser.close();
console.log(`\n${"═".repeat(60)}`);
console.log(`Results: ${totalPass} passed / ${totalFail} failed`);
