/**
 * BNN: scrape product listing from SSR DOM + extract Nuxt state.
 * Also discover the API call pattern for category listings.
 */
import { chromium } from "playwright";
const keyword = process.argv[2] || "iPhone 16";

const browser = await chromium.launch({
  headless: false,
  args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage",
         "--disable-blink-features=AutomationControlled",
         "--window-size=1366,768","--window-position=-8000,-8000","--lang=th-TH"],
  ignoreDefaultArgs: ["--enable-automation"],
});
const ctx = await browser.newContext({
  userAgent:"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  locale:"th-TH",timezoneId:"Asia/Bangkok",viewport:{width:1366,height:768},
  extraHTTPHeaders:{"accept-language":"th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7"},
});
await ctx.addInitScript(`Object.defineProperty(navigator,'webdriver',{get:()=>undefined});`);
const page = await ctx.newPage();

// Intercept ALL requests/responses to understand pattern
page.on("response", async resp => {
  const url = resp.url();
  if (!url.includes("api.bnn")) return;
  const ct = resp.headers()["content-type"] || "";
  if (!ct.includes("json")) return;
  try {
    const json = await resp.json();
    const s = JSON.stringify(json);
    if (!url.includes("categories") && !url.includes("pages") && !url.includes("home-p")) {
      console.log(`  [API] ${url.replace("https://api.bnn.in.th/","")} → ${s.slice(0,200)}`);
    }
  } catch {}
});

// Test the macbook-neo (known working) page
console.log("[1] macbook-neo page (known working)...");
await page.goto("https://www.bnn.in.th/p/apple/apple-mac/macbook-neo", {
  waitUntil: "networkidle", timeout: 30000
});
await page.waitForTimeout(2000);

// Extract __NUXT__ state (Nuxt.js SSR embeds initial data here)
const nuxtData = await page.evaluate(() => {
  try {
    // Nuxt 2: __NUXT__ / Nuxt 3: __NUXT_DATA__ or <script id="__NUXT_DATA__">
    if (window.__NUXT__) return { source: '__NUXT__', data: JSON.stringify(window.__NUXT__).slice(0, 3000) };
    const script = document.querySelector('#__NUXT_DATA__') || document.querySelector('script[id="__nuxt-data"]');
    if (script) return { source: 'script', data: script.textContent.slice(0, 3000) };
    // Look in all scripts for product-like JSON
    const scripts = [...document.querySelectorAll('script:not([src])')];
    for (const sc of scripts) {
      const t = sc.textContent;
      if (t.includes('"price_display"') || t.includes('"sale_price"')) {
        return { source: 'inline-script', data: t.slice(0, 3000) };
      }
    }
    return null;
  } catch(e) { return { source:'error', data: e.message }; }
});
console.log("Nuxt data:", JSON.stringify(nuxtData)?.slice(0, 500));

// DOM product scraping
const products = await page.evaluate(() => {
  // Try different selectors to find product cards
  const sels = [
    '[class*="product-card"]', '[class*="ProductCard"]',
    '[class*="product-item"]', '.product', '.item',
    '[class*="card"]', 'article',
    // BNN might use specific class names
    '[class*="bnn"]', '[class*="product"]',
  ];
  for (const sel of sels) {
    const found = [...document.querySelectorAll(sel)].filter(el => {
      const t = el.innerText;
      return t && (t.includes('฿') || t.match(/\d{4,}/)) && t.length > 30;
    });
    if (found.length > 1) {
      return {
        selector: sel,
        count: found.length,
        items: found.slice(0, 6).map(el => {
          // Extract price using regex
          const text = el.innerText;
          const priceMatch = text.match(/฿\s*([\d,]+(?:\.\d+)?)/);
          const lines = text.split('\n').filter(Boolean).slice(0, 5);
          // Try to get link
          const link = el.querySelector('a')?.href || '';
          return { lines, price: priceMatch?.[1], link: link.slice(0, 80) };
        })
      };
    }
  }
  return null;
});

if (products) {
  console.log(`\n✅ Products (${products.selector}, ${products.count} total):`);
  products.items.forEach((p, i) => {
    console.log(`  [${i}] ฿${p.price || '?'} → ${p.link}`);
    console.log(`       ${p.lines.join(' | ').slice(0, 100)}`);
  });
} else {
  console.log("  No products found in DOM");
  const body = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log("  Body:", body);
}

// Now test an iPhone page to see what URL works
console.log("\n[2] Testing iPhone category URLs...");
const iphoneUrls = [
  "https://www.bnn.in.th/p/apple/iphone",
  "https://www.bnn.in.th/p/apple/apple-iphone",
  "https://www.bnn.in.th/p/apple/iphone/iphone-16",
  "https://www.bnn.in.th/p/smartphone-and-accessories/apple/iphone-16",
];

for (const u of iphoneUrls) {
  const r = await page.goto(u, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => null);
  const title = await page.title().catch(() => "?");
  const finalUrl = page.url();
  const isError = title.includes("ขออภัย") || title.includes("404");
  console.log(`  ${isError ? '❌' : '✅'} ${u.replace("https://www.bnn.in.th","")} → "${title.slice(0,50)}"`);
  if (!isError) {
    await page.waitForTimeout(2000);
    for (let i = 0; i <= 3; i++) { await page.evaluate(s=>window.scrollTo(0,s*300),i); await page.waitForTimeout(200); }
    const dom = await page.evaluate(() => {
      const found = [...document.querySelectorAll('[class*="product"],[class*="card"],[class*="item"]')]
        .filter(el => el.innerText.includes('฿'));
      return found.slice(0,2).map(el=>el.innerText.split('\n').filter(Boolean).slice(0,2).join(' | ').slice(0,100));
    }).catch(()=>[]);
    dom.forEach(d=>console.log(`    → ${d}`));
  }
}

// Try search in the API with different keys
console.log("\n[3] Try API search variations via fetch...");
const apiTests = [
  "https://api.bnn.in.th/store/search-product?q=iphone&lang=th",
  "https://api.bnn.in.th/store/search?q=iphone&lang=th",
  `https://api.bnn.in.th/store/search-product?keyword=${encodeURIComponent(keyword)}&lang=th`,
  "https://api.bnn.in.th/store/catalog?q=iphone&lang=th&per_page=10",
  "https://api.bnn.in.th/store/product-listing?q=iphone&lang=th",
  "https://api.bnn.in.th/store/product?lang=th&per_page=1",  // no filter
  "https://api.bnn.in.th/store/product-group?lang=th&per_page=10",
  "https://api.bnn.in.th/store/sku?lang=th&keyword=iphone",
];
for (const url of apiTests) {
  const r = await page.evaluate(async u => {
    try {
      const res = await fetch(u, { headers: { accept: "application/json" } });
      const text = await res.text();
      return { status: res.status, body: text.slice(0, 300) };
    } catch(e) { return { status: 0, body: e.message }; }
  }, url).catch(() => ({ status: -1, body: "err" }));
  const short = url.replace("https://api.bnn.in.th/store/","").slice(0,50);
  if (r.status === 200) console.log(`  ✅ ${short}: ${r.body.slice(0,200)}`);
  else console.log(`  ❌ ${r.status} ${short}`);
}

await ctx.close();
await browser.close();
console.log("\n✅ Done");
