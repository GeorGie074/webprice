/**
 * Find the correct Banana IT search API endpoint.
 * Uses Playwright to intercept ALL api.bnn.in.th calls made during search.
 */
import { chromium } from "playwright";

const keyword = process.argv[2] || "iPhone 16";
console.log(`\n🍌 Finding BNN API for "${keyword}"\n`);

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
});
await ctx.addInitScript(`Object.defineProperty(navigator,'webdriver',{get:()=>undefined});`);

const page = await ctx.newPage();
const allApiCalls = [];

// Log ALL network requests to bnn
page.on("request", req => {
  const url = req.url();
  if (url.includes("bnn.in.th") || url.includes("api.bnn")) {
    console.log(`  → REQ ${req.method()} ${url.slice(0, 100)}`);
  }
});

page.on("response", async resp => {
  const url = resp.url();
  if (!url.includes("bnn.in.th") && !url.includes("api.bnn")) return;
  const ct = resp.headers()["content-type"] || "";
  if (!ct.includes("json")) return;
  try {
    const json = await resp.json();
    allApiCalls.push({ url, json });
    const preview = JSON.stringify(json).slice(0, 200);
    console.log(`  ← JSON ${url.slice(0, 80)}\n       ${preview}`);
  } catch {}
});

// Visit homepage
await page.goto("https://www.bnn.in.th/", { waitUntil: "domcontentloaded", timeout: 25000 });
await page.waitForTimeout(2000);

// Try searching using the page's own search box
console.log("[Search box] Looking for search input...");
const searchBox = await page.$('input[type="search"], input[placeholder*="search"], input[placeholder*="ค้นหา"], #search, [name="q"], [name="keyword"]');
if (searchBox) {
  console.log("  Found search box, typing...");
  await searchBox.click();
  await searchBox.type(keyword, { delay: 80 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3000);
  for (let i = 0; i <= 4; i++) {
    await page.evaluate(s => window.scrollTo(0, s * 300), i);
    await page.waitForTimeout(400);
  }
  const title = await page.title().catch(() => "?");
  console.log(`  After search — title: "${title}", url: ${page.url().slice(0, 80)}`);
} else {
  console.log("  No search box found");
  // Try direct URL
  const su = `https://www.bnn.in.th/th/search?keyword=${encodeURIComponent(keyword)}`;
  console.log(`  Direct: ${su}`);
  await page.goto(su, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(()=>{});
  await page.waitForTimeout(3000);
  for (let i = 0; i <= 5; i++) { await page.evaluate(s=>window.scrollTo(0,s*300),i); await page.waitForTimeout(350); }
}

await page.waitForTimeout(2000);

// DOM fallback
const dom = await page.evaluate(() => {
  const sels = ['.product-card','[class*="product"]','[class*="Product"]','.card','.item','article'];
  for (const sel of sels) {
    const found = [...document.querySelectorAll(sel)];
    if (found.length > 2) return found.slice(0,5).map(el => ({ sel, text: el.innerText?.split('\n').filter(Boolean).slice(0,3).join(' | ') }));
  }
  // Also show search input placeholder/value
  const inputs = [...document.querySelectorAll('input')].slice(0,5).map(i=>({type:i.type,ph:i.placeholder,val:i.value}));
  return [{ sel:'inputs', text: JSON.stringify(inputs) }];
}).catch(() => []);

dom.forEach((d,i) => console.log(`  DOM[${i}](${d.sel}): ${d.text?.slice(0,120)}`));

console.log("\n=== ALL API calls captured ===");
allApiCalls.forEach(c => {
  const k = JSON.stringify(c.json).slice(0, 300);
  console.log(`URL: ${c.url}\n  ${k}\n`);
});

await ctx.close();
await browser.close();
console.log("\n✅ Done");
