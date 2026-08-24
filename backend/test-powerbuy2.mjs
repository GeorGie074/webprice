/**
 * Power Buy scraper test — dismiss modal, then search.
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
await ctx.addInitScript(`
  Object.defineProperty(navigator,'webdriver',{get:()=>undefined});
  Object.defineProperty(navigator,'plugins',{get:()=>[1,2,3,4,5]});
  Object.defineProperty(navigator,'languages',{get:()=>['th-TH','th','en-US','en']});
  window.chrome={runtime:{},loadTimes:()=>{},csi:()=>{},app:{}};
`);
const page = await ctx.newPage();

const captured = [];

// Intercept product API responses
page.on("response", async resp => {
  const url = resp.url();
  const ct  = resp.headers()["content-type"] || "";
  if (!ct.includes("json")) return;
  // Capture anything from powerbuy or Algolia
  if (!url.includes("powerbuy") && !url.includes("algolia") && !url.includes("algolianet")) return;
  try {
    const json = await resp.json();
    const hits  = json?.hits
      || json?.results?.[0]?.hits
      || json?.data?.products || json?.data?.items
      || json?.products || json?.items || [];
    if (Array.isArray(hits) && hits.length > 0) {
      const first = hits[0];
      if (first.name || first.productName || first.title || first.sku) {
        captured.push({ url, hits });
        console.log(`\n  ✅ [API] ${url.slice(0,80)} — ${hits.length} items`);
        hits.slice(0,5).forEach((h,i) => {
          const name  = h.name || h.productName || h.title || h.objectID || "";
          const price = h.price || h.salePrice || h.specialPrice || h.promotionPrice || h.minPrice || 0;
          const link  = h.url || h.productUrl || h.pdpUrl || h.slug || "";
          console.log(`    [${i}] ฿${price} "${name.slice(0,60)}" → ${link.slice(0,60)}`);
        });
      }
    }
  } catch {}
});

console.log("[1] Loading homepage...");
await page.goto("https://www.powerbuy.co.th/en", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(3000);

const title = await page.title();
console.log(`  Title: "${title.slice(0,60)}"`);

// Close modal if present
console.log("[2] Closing popup/modal if present...");
const closeSelectors = [
  // MUI modal close patterns
  'button[aria-label="close" i]',
  'button[aria-label="Close" i]',
  '.MuiModal-root button',
  '[class*="Modal"] button',
  '[class*="modal"] button',
  '[class*="popup"] button',
  '[class*="Popup"] button',
  '[class*="close"]',
  '[class*="dismiss"]',
  '[data-testid*="close"]',
  'button:has-text("ปิด")',
  'button:has-text("Close")',
  'button:has-text("OK")',
  'button:has-text("ยอมรับ")',
  'button:has-text("ตกลง")',
];
for (const sel of closeSelectors) {
  const btn = await page.$(sel).catch(() => null);
  if (btn) {
    try {
      await btn.click({ force: true, timeout: 2000 });
      console.log(`  Clicked: ${sel}`);
      await page.waitForTimeout(1000);
      break;
    } catch {}
  }
}

// Also try pressing Escape
await page.keyboard.press("Escape");
await page.waitForTimeout(1000);

// Check if modal is gone
const backdropGone = await page.$('.MuiBackdrop-root[aria-hidden="true"]').then(e => !e).catch(() => true);
console.log(`  Backdrop gone: ${backdropGone}`);

// Try navigating to search URL (after homepage cookie established)
const searchUrl = `https://www.powerbuy.co.th/en/search/${encodeURIComponent(keyword)}`;
console.log(`[3] Navigating to search: ${searchUrl}`);
await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(3000);

const searchTitle = await page.title();
const searchPageUrl = page.url();
console.log(`  Title: "${searchTitle.slice(0,70)}"`);
console.log(`  URL: ${searchPageUrl.slice(0,80)}`);

// Scroll to trigger lazy-load
for (let i = 0; i <= 6; i++) {
  await page.evaluate(s => window.scrollTo(0, s * 300), i);
  await page.waitForTimeout(400);
}
await page.waitForTimeout(2000);

// DOM check
const dom = await page.evaluate(() => {
  const sels = [
    '[class*="product-card"]','[class*="ProductCard"]',
    '[class*="productCard"]','[class*="product-list"]',
    '[class*="ProductList"]','[data-testid*="product"]',
    '.product','.item-card','li.item',
  ];
  for (const sel of sels) {
    const found = [...document.querySelectorAll(sel)];
    const withContent = found.filter(el => el.innerText && el.innerText.length > 20);
    if (withContent.length > 1) {
      return withContent.slice(0,5).map(el=>({
        sel,
        text: el.innerText.split('\n').filter(Boolean).slice(0,4).join(' | ').slice(0,120)
      }));
    }
  }
  // Show all text content to understand page
  const body = document.body.innerText.slice(0,600);
  return [{ sel:'body', text: body }];
}).catch(()=>[]);

if (dom.length && dom[0].sel !== 'body') {
  console.log(`\n  ✅ DOM products (${dom[0].sel}):`);
  dom.forEach((d,i)=>console.log(`    [${i}] ${d.text}`));
} else {
  console.log(`  Page text: ${dom[0]?.text || 'empty'}`);
}

if (captured.length === 0) {
  console.log("\n  ❌ No API captured. Current URL:", page.url());
}

await ctx.close();
await browser.close();
console.log("\n✅ Done");
