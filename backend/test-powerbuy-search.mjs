/**
 * Test Power Buy and BNN by using real search box interaction
 * to capture the API endpoint.
 */
import { chromium } from "playwright";

const keyword = process.argv[2] || "iPhone 16";
const target  = process.argv[3] || "both"; // powerbuy | bnn | both

const browser = await chromium.launch({
  headless: false,
  args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage",
         "--disable-blink-features=AutomationControlled",
         "--window-size=1366,768","--window-position=-8000,-8000","--lang=th-TH"],
  ignoreDefaultArgs: ["--enable-automation"],
});

const STEALTH = `
  Object.defineProperty(navigator,'webdriver',{get:()=>undefined});
  Object.defineProperty(navigator,'plugins',{get:()=>[1,2,3,4,5]});
  Object.defineProperty(navigator,'languages',{get:()=>['th-TH','th','en-US','en']});
  window.chrome={runtime:{},loadTimes:()=>{},csi:()=>{},app:{}};
`;

// ─── POWER BUY ────────────────────────────────────────────────────────────────
async function testPB(kw) {
  console.log(`\n${"═".repeat(60)}\n🔵 Power Buy search box test — "${kw}"\n${"═".repeat(60)}`);
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "th-TH", timezoneId: "Asia/Bangkok", viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: { "accept-language": "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7" },
  });
  await ctx.addInitScript(STEALTH);
  const page = await ctx.newPage();

  // Capture ALL JSON responses
  page.on("response", async resp => {
    const url = resp.url();
    const ct  = resp.headers()["content-type"] || "";
    if (!ct.includes("json")) return;
    if (!url.includes("powerbuy") && !url.includes("algolia") && !url.includes("algolianet")) return;
    try {
      const json = await resp.json();
      const hits = json?.hits || json?.results?.[0]?.hits || json?.data || [];
      if (Array.isArray(hits) && hits.length > 0 && (hits[0].name || hits[0].productName)) {
        console.log(`\n  [PB HIT] ${url.slice(0,80)}`);
        hits.slice(0,5).forEach((h,i) => {
          const name  = h.name || h.productName || h.title || "";
          const price = h.price || h.salePrice || h.specialPrice || h.promotionPrice || 0;
          const link  = h.url || h.productUrl || h.sku || "";
          console.log(`    [${i}] ฿${price} "${name.slice(0,60)}" → ${link.slice(0,50)}`);
        });
      } else if (url.includes("algolia")) {
        const s = JSON.stringify(json);
        if (s.length > 50) console.log(`  [Algolia] ${url.slice(0,60)}: ${s.slice(0,200)}`);
      }
    } catch {}
  });

  try {
    // Long homepage warm-up
    console.log("[1] Homepage warm-up (5s)...");
    await page.goto("https://www.powerbuy.co.th/en", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(5000);  // long wait to pass Cloudflare

    const title = await page.title().catch(() => "?");
    console.log(`  Title: "${title.slice(0,60)}"`);

    if (title.includes("Cloudflare") || title.includes("blocked")) {
      console.log("  ❌ Still blocked by Cloudflare — trying to wait more...");
      await page.waitForTimeout(5000);
    }

    // Find search box
    const searchSels = [
      'input[type="search"]', 'input[placeholder*="search" i]', 'input[placeholder*="ค้นหา"]',
      '#search-input', '[name="q"]', '[name="keyword"]', '[class*="search-input"]',
      '[data-testid*="search"]', '[aria-label*="search" i]',
    ];
    let searchBox = null;
    for (const sel of searchSels) {
      searchBox = await page.$(sel);
      if (searchBox) { console.log(`  Found: ${sel}`); break; }
    }

    if (searchBox) {
      await searchBox.click();
      await searchBox.fill("");
      await searchBox.type(kw, { delay: 100 });
      console.log(`  Typed "${kw}" — pressing Enter...`);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(5000); // wait for search to load
    } else {
      console.log("  No search box — trying direct URL...");
      await page.goto(`https://www.powerbuy.co.th/en/search/${encodeURIComponent(kw)}`,
        { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(3000);
    }

    const afterTitle = await page.title().catch(() => "?");
    const afterUrl   = page.url();
    console.log(`  After: "${afterTitle.slice(0,60)}" | ${afterUrl.slice(0,80)}`);

    // DOM check
    for (let i = 0; i <= 5; i++) { await page.evaluate(s=>window.scrollTo(0,s*300),i); await page.waitForTimeout(300); }
    const dom = await page.evaluate(() => {
      const sels = ['[class*="product-card"]','[class*="ProductCard"]','[class*="product"]','.item','article'];
      for (const sel of sels) {
        const found = [...document.querySelectorAll(sel)];
        const withPrice = found.filter(el => el.innerText && (el.innerText.includes("฿") || el.innerText.match(/\d{4,}/)));
        if (withPrice.length > 0) return withPrice.slice(0,3).map(el=>({sel,text:el.innerText.split('\n').filter(Boolean).slice(0,3).join(' | ').slice(0,120)}));
      }
      return [];
    }).catch(()=>[]);
    if (dom.length) {
      console.log(`  ✅ DOM products (${dom[0].sel})`);
      dom.forEach((d,i) => console.log(`    [${i}] ${d.text}`));
    }
  } catch (e) {
    console.error("  Error:", e.message);
  } finally {
    await ctx.close().catch(()=>{});
  }
}

// ─── BANANA IT — try to find search URL from source ──────────────────────────
async function testBNNSource(kw) {
  console.log(`\n${"═".repeat(60)}\n🍌 BNN source search — "${kw}"\n${"═".repeat(60)}`);
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "th-TH", timezoneId: "Asia/Bangkok", viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: { "accept-language": "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7" },
  });
  await ctx.addInitScript(STEALTH);
  const page = await ctx.newPage();

  page.on("response", async resp => {
    const url = resp.url();
    const ct  = resp.headers()["content-type"] || "";
    if (!url.includes("api.bnn")) return;
    if (!ct.includes("json")) return;
    try {
      const json = await resp.json();
      const arr  = json.data || json.results || [];
      if (Array.isArray(arr) && arr.length > 0 && arr[0].name && arr[0].price_display) {
        console.log(`\n  [BNN PRODUCT API] ${url}`);
        arr.slice(0,5).forEach((it,i) => {
          console.log(`    [${i}] ฿${it.price_display||it.sale_price||it.price} "${(it.name||"").slice(0,60)}" slug=${it.slug||it.url||""}`);
        });
      } else if (!url.includes("categories") && !url.includes("pages") && !url.includes("home-p")) {
        const s = JSON.stringify(json);
        if (s.length > 10) console.log(`  [BNN API] ${url}\n    ${s.slice(0,300)}`);
      }
    } catch {}
  });

  await page.goto("https://www.bnn.in.th/th", { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForTimeout(2000);

  // Get all URLs from the loaded JS to find search pattern
  const allLinks = await page.evaluate(() => {
    // Find links in nav that look like search-related
    const links = [...document.querySelectorAll('a[href*="search"]')].map(a => a.href);
    // Find the search form action
    const forms = [...document.querySelectorAll('form')].map(f => ({
      action: f.action, method: f.method,
      inputs: [...f.querySelectorAll('input')].map(i => ({ name: i.name, type: i.type, placeholder: i.placeholder }))
    }));
    return { links, forms };
  });
  console.log("  Links:", allLinks.links.slice(0, 5));
  console.log("  Forms:", JSON.stringify(allLinks.forms).slice(0, 300));

  // Try typing in search box and watching URL change
  const searchBox = await page.$('input[type="search"], input[placeholder*="ค้นหา"], input[placeholder*="search" i], #search');
  if (searchBox) {
    console.log("  [Search box] Found! Typing...");
    await searchBox.click();
    await searchBox.type(kw, { delay: 80 });
    // Wait for autocomplete suggestions to appear
    await page.waitForTimeout(1500);
    // Check for suggestion dropdown
    const suggestions = await page.evaluate(() => {
      const sels = ['[class*="suggest"]','[class*="autocomplete"]','[class*="dropdown"]','[class*="result"]'];
      for (const sel of sels) {
        const el = document.querySelector(sel);
        if (el && el.innerText.trim()) return { sel, text: el.innerText.slice(0,300) };
      }
      return null;
    });
    if (suggestions) console.log(`  Autocomplete (${suggestions.sel}): ${suggestions.text}`);

    // Press Enter
    console.log("  Pressing Enter...");
    await Promise.all([
      page.waitForNavigation({ timeout: 10000 }).catch(() => {}),
      page.keyboard.press("Enter"),
    ]);
    await page.waitForTimeout(3000);
    const newUrl = page.url();
    const newTitle = await page.title().catch(()=>"?");
    console.log(`  After Enter: url=${newUrl.slice(0,80)} title="${newTitle.slice(0,60)}"`);

    // Scroll and check
    for (let i = 0; i <= 5; i++) { await page.evaluate(s=>window.scrollTo(0,s*300),i); await page.waitForTimeout(300); }
    await page.waitForTimeout(2000);
  } else {
    console.log("  No search box found");
    // Inspect all inputs
    const inputs = await page.evaluate(() =>
      [...document.querySelectorAll('input')].map(i=>({ type:i.type,name:i.name,ph:i.placeholder,id:i.id,cls:i.className.slice(0,50) }))
    );
    console.log("  Inputs:", JSON.stringify(inputs).slice(0,500));
  }

  await ctx.close().catch(()=>{});
}

if (target === "powerbuy" || target === "both") await testPB(keyword);
if (target === "bnn"      || target === "both") await testBNNSource(keyword);

await browser.close().catch(()=>{});
console.log("\n✅ Done");
