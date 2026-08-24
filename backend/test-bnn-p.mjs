/**
 * BNN: test /p/ URL pattern for product pages and search.
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

const productApis = [];
page.on("response", async resp => {
  const url = resp.url();
  if (!url.includes("api.bnn.in.th")) return;
  const ct = resp.headers()["content-type"] || "";
  if (!ct.includes("json")) return;
  try {
    const json = await resp.json();
    const preview = JSON.stringify(json).slice(0, 200);
    if (url.includes("categories") || url.includes("pages") || url.includes("home-p")) return;
    console.log(`  [API] ${url.replace("https://api.bnn.in.th/","")}`);
    console.log(`        ${preview}`);
    productApis.push({ url, json });
  } catch {}
});

// Test different /p/ URLs
const testUrls = [
  "https://www.bnn.in.th/p/apple/iphone",
  "https://www.bnn.in.th/p/apple",
  `https://www.bnn.in.th/search?q=${encodeURIComponent(keyword)}`,
  `https://www.bnn.in.th/th/p/apple/iphone`,
];

for (const su of testUrls) {
  console.log(`\n${"─".repeat(60)}\n[Test] ${su}`);
  productApis.length = 0;

  await page.goto(su, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  for (let i = 0; i <= 5; i++) { await page.evaluate(s=>window.scrollTo(0,s*300),i); await page.waitForTimeout(300); }
  await page.waitForTimeout(2000);

  const title = await page.title();
  const finalUrl = page.url();
  console.log(`  title="${title.slice(0,60)}" url=${finalUrl.slice(0,80)}`);

  // Check DOM for products
  const dom = await page.evaluate(() => {
    const sels = ['[class*="product"]','[class*="card"]','[class*="item"]','article'];
    for (const sel of sels) {
      const found = [...document.querySelectorAll(sel)].filter(el => el.innerText.includes("฿"));
      if (found.length > 1) return found.slice(0,3).map(el=>({sel,text:el.innerText.split('\n').filter(Boolean).slice(0,3).join(' | ').slice(0,120)}));
    }
    return null;
  }).catch(()=>null);

  if (dom && dom.length) {
    console.log(`  ✅ DOM (${dom[0].sel}):`);
    dom.forEach((d,i)=>console.log(`    [${i}] ${d.text}`));
  } else {
    const body = await page.evaluate(()=>document.body.innerText.slice(0,200));
    console.log(`  body: ${body}`);
  }

  if (productApis.some(a => a.json?.data && Array.isArray(a.json.data) && a.json.data[0]?.price_display)) {
    console.log("  ✅ Found product API!");
    break;
  }
}

// Now check the BNN search via the macbook-neo example (from homepage link)
console.log(`\n${"─".repeat(60)}\n[Test macbook-neo example URL]`);
productApis.length = 0;
await page.goto("https://www.bnn.in.th/p/apple/apple-mac/macbook-neo", { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
await page.waitForTimeout(3000);
for (let i = 0; i <= 5; i++) { await page.evaluate(s=>window.scrollTo(0,s*300),i); await page.waitForTimeout(300); }
await page.waitForTimeout(2000);

const macTitle = await page.title();
const macUrl   = page.url();
console.log(`  title="${macTitle.slice(0,60)}" url=${macUrl.slice(0,80)}`);
const macDom = await page.evaluate(() => {
  const found = [...document.querySelectorAll('[class*="product"],[class*="card"]')].filter(el => el.innerText.includes("฿"));
  return found.slice(0,3).map(el=>({text:el.innerText.split('\n').filter(Boolean).slice(0,3).join(' | ').slice(0,120)}));
}).catch(()=>[]);
macDom.forEach((d,i)=>console.log(`  [${i}] ${d.text}`));

await ctx.close();
await browser.close();
console.log("\n✅ Done");
