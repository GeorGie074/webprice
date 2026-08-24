/**
 * Power Buy — use search INPUT (not URL navigation) to trigger real search.
 * Dismiss modal first, then type and Enter through the search box.
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

page.on("response", async resp => {
  const url = resp.url();
  const ct  = resp.headers()["content-type"] || "";
  if (!ct.includes("json")) return;
  if (!url.includes("powerbuy") && !url.includes("algolia") && !url.includes("algolianet")) return;
  try {
    const json = await resp.json();
    const hits  = json?.hits || json?.results?.[0]?.hits || json?.data?.products || json?.products || json?.items || [];
    if (Array.isArray(hits) && hits.length > 0) {
      const first = hits[0];
      if (first.name || first.productName || first.title || first.sku || first.objectID) {
        captured.push({ url, hits });
        console.log(`\n  ✅ [${url.includes('algolia') ? 'Algolia' : 'PB API'}] ${url.slice(0,80)} — ${hits.length} items`);
        hits.slice(0,5).forEach((h,i) => {
          const name  = h.name || h.productName || h.title || h.objectID || "";
          const price = h.price || h.salePrice || h.specialPrice || h.promotionPrice || h.minPrice ||
                        h._highlightResult?.price?.value || 0;
          const link  = h.url || h.productUrl || h.pdpUrl || h.slug || h.objectID || "";
          console.log(`    [${i}] ฿${price} "${name.slice(0,60)}" → ${link.slice(0,60)}`);
        });
      }
    }
    // Also show any JSON with price data
    const s = JSON.stringify(json);
    if (s.includes('"price"') && s.includes('"name"') && !s.includes('"type":"category"')) {
      if (!captured.find(c => c.url === url)) {
        console.log(`\n  [JSON w/price] ${url.slice(0,80)}: ${s.slice(0,300)}`);
      }
    }
  } catch {}
});

// [1] Homepage
console.log("[1] Loading homepage...");
await page.goto("https://www.powerbuy.co.th/en", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(4000);

// [2] Dismiss modal — click backdrop or close button
console.log("[2] Dismiss modal...");
try {
  // Try close button first
  await page.click('button[aria-label="close" i]', { timeout: 2000, force: true }).catch(() => {});
  // Try ESC
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  // Force remove backdrop via JS
  await page.evaluate(() => {
    document.querySelectorAll('.MuiModal-root,.MuiBackdrop-root').forEach(el => {
      el.style.display = 'none';
      el.remove();
    });
  });
  await page.waitForTimeout(500);
} catch {}

// [3] Click search box
console.log("[3] Looking for search box...");
const searchSels = [
  '#search-input',
  'input[id*="search"]',
  'input[name*="search"]',
  'input[placeholder*="ค้นหา"]',
  'input[placeholder*="search" i]',
  'input[type="search"]',
  'header input',
  'nav input',
  '[class*="search"] input',
  '[class*="Search"] input',
];
let searchBox = null;
for (const sel of searchSels) {
  searchBox = await page.$(sel).catch(() => null);
  if (searchBox) {
    // Check it's not hidden
    const vis = await searchBox.isVisible().catch(() => false);
    if (vis) { console.log(`  Found: ${sel}`); break; }
    searchBox = null;
  }
}

if (!searchBox) {
  // Show all inputs as debug
  const inputs = await page.evaluate(() =>
    [...document.querySelectorAll('input')].map(i => ({
      type: i.type, id: i.id, name: i.name, ph: i.placeholder,
      cls: i.className.slice(0, 50), vis: i.offsetHeight > 0
    }))
  );
  console.log("  All inputs:", JSON.stringify(inputs).slice(0, 500));
} else {
  await searchBox.click({ force: true });
  await page.waitForTimeout(500);
  await searchBox.fill(keyword);
  console.log(`  Typed: "${keyword}"`);
  await page.waitForTimeout(1000);

  // Check for autocomplete/suggestions
  const suggest = await page.evaluate(() => {
    const s = document.querySelector('[class*="suggest"],[class*="Suggest"],[class*="autocomplete"],[role="listbox"]');
    return s ? s.innerText.slice(0, 200) : null;
  });
  if (suggest) console.log(`  Suggestion: ${suggest}`);

  // Press Enter and wait for navigation
  console.log("  Pressing Enter...");
  await Promise.all([
    page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
    page.keyboard.press("Enter"),
  ]);
  await page.waitForTimeout(4000);
}

const finalTitle = await page.title();
const finalUrl   = page.url();
console.log(`[4] Result: "${finalTitle.slice(0,60)}" | ${finalUrl.slice(0,80)}`);

// Scroll
for (let i = 0; i <= 6; i++) { await page.evaluate(s=>window.scrollTo(0,s*300),i); await page.waitForTimeout(300); }
await page.waitForTimeout(2000);

// DOM
const dom = await page.evaluate(() => {
  const sels = ['[class*="product-card"]','[class*="ProductCard"]','[class*="productCard"]',
                '[class*="product-list"]','[class*="ProductList"]','[data-testid*="product"]',
                '.product','.product-item','li.item'];
  for (const sel of sels) {
    const found = [...document.querySelectorAll(sel)];
    const withContent = found.filter(el => el.innerText && (el.innerText.includes('฿') || el.innerText.match(/\d{4,}/)));
    if (withContent.length > 0) {
      return withContent.slice(0,3).map(el=>({
        sel, text: el.innerText.split('\n').filter(Boolean).slice(0,4).join(' | ').slice(0,150)
      }));
    }
  }
  return [{sel:'body', text: document.body.innerText.slice(0,600)}];
}).catch(()=>[]);

if (dom[0]?.sel !== 'body' && dom.length) {
  console.log(`\n  ✅ Products (${dom[0].sel}):`);
  dom.forEach((d,i) => console.log(`    [${i}] ${d.text}`));
} else {
  console.log(`  Page: ${dom[0]?.text}`);
}

await ctx.close();
await browser.close();
console.log("\n✅ Done");
