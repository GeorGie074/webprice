/**
 * Test BNN search by intercepting actual search requests from the website.
 * Uses the search box to trigger real search and capture API call.
 */
import { chromium } from "playwright";

const keyword = process.argv[2] || "iPhone 16";
console.log(`\n🍌 BNN search test: "${keyword}"\n`);

const browser = await chromium.launch({
  headless: false,
  args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage",
         "--disable-blink-features=AutomationControlled",
         "--window-size=1366,768","--window-position=-8000,-8000","--lang=th-TH"],
  ignoreDefaultArgs: ["--enable-automation"],
});
const ctx = await browser.newContext({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  locale: "th-TH", timezoneId: "Asia/Bangkok", viewport: { width: 1366, height: 768 },
  extraHTTPHeaders: { "accept-language": "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7" },
});
await ctx.addInitScript(`Object.defineProperty(navigator,'webdriver',{get:()=>undefined});`);

const page = await ctx.newPage();

// Capture EVERYTHING from api.bnn.in.th
page.on("response", async resp => {
  const url = resp.url();
  if (!url.includes("api.bnn.in.th")) return;
  const ct = resp.headers()["content-type"] || "";
  if (!ct.includes("json")) return;
  try {
    const json = await resp.json();
    const s = JSON.stringify(json);
    // Only show if it looks like it might have products
    if (s.includes('"price"') || s.includes('"name"') || s.includes('"slug"')) {
      console.log(`\n[API] ${url}`);
      // Try to find product-like arrays
      const arr = json.data || json.results || json.hits || json.products || [];
      if (Array.isArray(arr) && arr.length > 0 && arr[0].name) {
        arr.slice(0, 5).forEach((it, i) => {
          const p = it.price_display || it.sale_price || it.price || 0;
          const u = it.url || it.slug || it.product_url || "";
          console.log(`  [${i}] ฿${p} "${(it.name||"").slice(0,60)}" → ${u.slice(0,50)}`);
        });
      } else {
        console.log("  " + s.slice(0, 300));
      }
    }
  } catch {}
});

// Visit homepage
await page.goto("https://www.bnn.in.th/th", { waitUntil: "domcontentloaded", timeout: 25000 });
await page.waitForTimeout(2000);

// Try several search URL patterns
const searchPatterns = [
  `https://www.bnn.in.th/th/search?keyword=${encodeURIComponent(keyword)}`,
  `https://www.bnn.in.th/en/search?keyword=${encodeURIComponent(keyword)}`,
  `https://www.bnn.in.th/th/catalog?q=${encodeURIComponent(keyword)}`,
  `https://www.bnn.in.th/th/search/${encodeURIComponent(keyword)}`,
];

for (const su of searchPatterns) {
  console.log(`\n[Try] ${su}`);
  const r = await page.goto(su, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => null);
  const status = r ? r.status() : "ERR";
  const title = await page.title().catch(() => "?");
  const finalUrl = page.url();
  console.log(`  status=${status} title="${title.slice(0,60)}" url=${finalUrl.slice(0,70)}`);

  // Check for product cards
  await page.waitForTimeout(2000);
  for (let i = 0; i <= 4; i++) { await page.evaluate(s=>window.scrollTo(0,s*300),i); await page.waitForTimeout(300); }

  const products = await page.evaluate(() => {
    const sels = ['[class*="product-card"]','[class*="ProductCard"]','[class*="product-item"]',
                  '.product','.item','[class*="product"]'];
    for (const sel of sels) {
      const found = [...document.querySelectorAll(sel)];
      if (found.length > 1) {
        // Check if any have price info
        const withPrice = found.filter(el => el.innerText.includes('฿') || el.innerText.match(/\d{3,}/));
        if (withPrice.length > 0) {
          return withPrice.slice(0,3).map(el => ({
            sel,
            text: el.innerText.split('\n').filter(Boolean).slice(0,3).join(' | ').slice(0,120)
          }));
        }
      }
    }
    return [];
  }).catch(() => []);

  if (products.length > 0) {
    console.log(`  ✅ Products found! (${products[0].sel})`);
    products.forEach((p,i) => console.log(`    [${i}] ${p.text}`));
    break;
  }

  if (finalUrl.includes("search") && !finalUrl.includes(page.url().includes("th") ? "th" : "error")) {
    await page.waitForTimeout(1000);
  }
}

// Try direct API call
console.log("\n[Direct API] Trying search endpoints...");
const apiEndpoints = [
  `https://api.bnn.in.th/store/search?keyword=${encodeURIComponent(keyword)}&lang=th`,
  `https://api.bnn.in.th/store/search?q=${encodeURIComponent(keyword)}&lang=th`,
  `https://api.bnn.in.th/store/products?keyword=${encodeURIComponent(keyword)}&lang=th&per_page=12`,
  `https://api.bnn.in.th/store/catalog?keyword=${encodeURIComponent(keyword)}&lang=th`,
];

for (const url of apiEndpoints) {
  const result = await page.evaluate(async (u) => {
    try {
      const r = await fetch(u, { headers: { "accept": "application/json" } });
      const text = await r.text();
      return { status: r.status, body: text.slice(0, 500) };
    } catch (e) {
      return { status: 0, body: e.message };
    }
  }, url).catch(() => ({ status: -1, body: "eval error" }));
  console.log(`  ${url.slice(0,70)}\n    status=${result.status} → ${result.body.slice(0,200)}`);
}

await ctx.close();
await browser.close();
console.log("\n✅ Done");
