/**
 * BNN category-based search test.
 * Since BNN search URL returns 404, try their category/product API endpoints.
 */
import { chromium } from "playwright";

const keyword = process.argv[2] || "iPhone 16";
console.log(`\n🍌 BNN category API test: "${keyword}"\n`);

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

// First, capture ALL api.bnn.in.th responses
const capturedApis = [];
page.on("response", async resp => {
  const url = resp.url();
  if (!url.includes("api.bnn.in.th")) return;
  const ct = resp.headers()["content-type"] || "";
  if (!ct.includes("json")) return;
  try {
    const json = await resp.json();
    capturedApis.push({ url, json });
  } catch {}
});

// Go to BNN homepage and observe ALL API calls
await page.goto("https://www.bnn.in.th/th", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);

// Now navigate to Apple category page and capture API calls
console.log("[1] Navigating to Apple category...");
capturedApis.length = 0; // clear
await page.goto("https://www.bnn.in.th/th/apple", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3000);
for (let i = 0; i <= 5; i++) { await page.evaluate(s=>window.scrollTo(0,s*300),i); await page.waitForTimeout(300); }
await page.waitForTimeout(2000);

console.log(`\nAPI calls from Apple category page (${capturedApis.length}):`);
capturedApis.forEach(c => {
  const arr = c.json?.data || c.json?.products || c.json?.items || [];
  if (Array.isArray(arr) && arr.length > 0 && arr[0]?.name && arr[0]?.price_display !== undefined) {
    console.log(`\n  ✅ PRODUCT API: ${c.url}`);
    arr.slice(0, 5).forEach((it,i) => {
      console.log(`    [${i}] ฿${it.price_display || it.sale_price || it.price} "${(it.name||"").slice(0,60)}" slug=${it.slug||""}`);
    });
  } else {
    const preview = JSON.stringify(c.json).slice(0, 150);
    if (!c.url.includes("categories") && !c.url.includes("pages") && !c.url.includes("home-p")) {
      console.log(`  ${c.url.slice(0,80)}\n    ${preview}`);
    }
  }
});

// Try calling the product API directly with search/keyword params
console.log("\n[2] Testing API endpoints with fetch...");
const endpoints = [
  "https://api.bnn.in.th/store/product?lang=th&per_page=20&keyword=iPhone+16",
  "https://api.bnn.in.th/store/product?lang=th&per_page=20&search=iPhone+16",
  "https://api.bnn.in.th/store/product?lang=th&per_page=20&q=iPhone+16",
  "https://api.bnn.in.th/store/product?lang=th&per_page=20&name=iPhone+16",
  "https://api.bnn.in.th/store/category/apple/product?lang=th&per_page=20",
  "https://api.bnn.in.th/store/category/apple?lang=th&include=products",
];

for (const url of endpoints) {
  const r = await page.evaluate(async u => {
    try {
      const res = await fetch(u, { headers: { accept: "application/json" } });
      const text = await res.text();
      return { status: res.status, body: text.slice(0, 400) };
    } catch(e) { return { status: 0, body: e.message }; }
  }, url);
  console.log(`  ${url.replace("https://api.bnn.in.th/store/","")}`);
  if (r.status === 200) {
    console.log(`    ✅ 200: ${r.body.slice(0, 200)}`);
  } else {
    console.log(`    ❌ ${r.status}: ${r.body.slice(0, 100)}`);
  }
}

// Let's look at the actual fetched URL that returns product data from the Apple category page
console.log("\n[3] Check DOM on Apple category page...");
const dom = await page.evaluate(() => {
  const sels = ['[class*="product"]','[class*="Product"]','.card','.item','article'];
  for (const sel of sels) {
    const found = [...document.querySelectorAll(sel)].filter(el => el.innerText.includes("฿"));
    if (found.length > 0) return found.slice(0,3).map(el=>({sel, text: el.innerText.split('\n').filter(Boolean).slice(0,3).join(' | ').slice(0,120)}));
  }
  return [{sel:"body", text: document.body.innerText.slice(0,300)}];
}).catch(()=>[]);
dom.forEach((d,i)=>console.log(`  [${i}](${d.sel}): ${d.text}`));

// Final: show all captured API JSON keys to understand structure
console.log("\n[4] All captured API response structures:");
capturedApis.forEach(c => {
  const keys = Object.keys(c.json || {}).join(", ");
  const firstDataKeys = c.json?.data && typeof c.json.data === 'object' && !Array.isArray(c.json.data)
    ? "data.keys=" + Object.keys(c.json.data).join(",") : "";
  console.log(`  ${c.url.replace("https://api.bnn.in.th/","").slice(0,60)}: {${keys}} ${firstDataKeys}`);
});

await ctx.close();
await browser.close();
console.log("\n✅ Done");
