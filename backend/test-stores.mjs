/**
 * Quick test for all 4 new store scrapers.
 * Usage: node test-stores.mjs [store] [keyword]
 *   store: jd | powerbuy | banana | central  (default: all)
 *   keyword: search term (default: "iPhone 16")
 *
 * Example: node test-stores.mjs powerbuy "Samsung Galaxy S25"
 */
import { chromium } from "playwright";

const store   = process.argv[2] && !process.argv[2].includes(" ") ? process.argv[2] : "all";
const keyword = process.argv[3] || (process.argv[2]?.includes(" ") ? process.argv[2] : "iPhone 16");

const browser = await chromium.launch({
  headless: false,
  args: [
    "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
    "--window-size=1366,768", "--window-position=-8000,-8000", "--lang=th-TH",
  ],
  ignoreDefaultArgs: ["--enable-automation"],
});

const STEALTH = `
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'plugins',   { get: () => [1,2,3,4,5] });
  Object.defineProperty(navigator, 'languages', { get: () => ['th-TH','th','en-US','en'] });
  window.chrome = { runtime:{}, loadTimes:()=>{}, csi:()=>{}, app:{} };
`;

async function makeContext() {
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "th-TH", timezoneId: "Asia/Bangkok", viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: { "accept-language": "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7" },
  });
  await ctx.addInitScript(STEALTH);
  return ctx;
}

// ─── Helper: scroll & wait ────────────────────────────────────────────────────
async function scrollDown(page, steps = 5) {
  for (let i = 0; i <= steps; i++) {
    await page.evaluate((s) => window.scrollTo(0, s * 300), i);
    await page.waitForTimeout(350);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// JD CENTRAL — intercept their product list API
// ═══════════════════════════════════════════════════════════════════════════════
async function testJD(kw) {
  console.log(`\n${"═".repeat(60)}\n🟠 JD Central — "${kw}"\n${"═".repeat(60)}`);
  const ctx  = await makeContext();
  const page = await ctx.newPage();
  const captured = [];

  // Intercept all JSON responses to find the product API
  page.on("response", async (resp) => {
    const url = resp.url();
    if (!url.includes("jd.co.th")) return;
    const ct = resp.headers()["content-type"] || "";
    if (!ct.includes("json")) return;
    try {
      const json = await resp.json();
      // JD stores products in various shapes — look for arrays of objects with price
      const flatten = (obj, depth = 0) => {
        if (depth > 4 || !obj || typeof obj !== "object") return [];
        if (Array.isArray(obj)) return obj.flatMap(x => flatten(x, depth + 1));
        if (obj.skuName && obj.jdPrice) return [obj];
        if (obj.name && (obj.price || obj.salePrice)) return [obj];
        return Object.values(obj).flatMap(v => flatten(v, depth + 1));
      };
      const items = flatten(json);
      if (items.length > 0) {
        captured.push({ url, items });
        console.log(`  [JD API] ${url.slice(0, 80)}`);
        items.slice(0, 5).forEach((it, i) =>
          console.log(`    [${i}] ฿${it.jdPrice ?? it.price ?? it.salePrice} "${(it.skuName ?? it.name ?? "").slice(0,60)}"`)
        );
      }
    } catch {}
  });

  try {
    console.log("[1] Homepage...");
    await page.goto("https://www.jd.co.th/", { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(1500);

    const searchUrl = `https://www.jd.co.th/search/?keyword=${encodeURIComponent(kw)}&page=1`;
    console.log(`[2] Search: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await scrollDown(page, 6);
    await page.waitForTimeout(2000);

    const title = await page.title().catch(() => "?");
    console.log(`  Page title: "${title.slice(0, 70)}"`);

    if (captured.length === 0) {
      // DOM fallback — inspect product cards
      const dom = await page.evaluate(() => {
        const selectors = [
          '.goods-item', '.product-item', '[class*="product"]',
          '[class*="goods"]', '[class*="item"]', 'li[data-sku]'
        ];
        for (const sel of selectors) {
          const found = document.querySelectorAll(sel);
          if (found.length > 2) {
            return Array.from(found).slice(0, 5).map(el => ({
              sel,
              text: (el.innerText || "").split("\n").filter(Boolean).slice(0,4).join(" | "),
            }));
          }
        }
        // last resort: all links with ฿
        return Array.from(document.querySelectorAll("a")).filter(a => a.innerText.includes("฿"))
          .slice(0, 5).map(a => ({ sel: "a[฿]", text: a.innerText.replace(/\s+/g," ").slice(0,100) }));
      }).catch(() => []);
      if (dom.length) {
        console.log(`  DOM (${dom[0].sel}): ${dom.length} items`);
        dom.forEach((d, i) => console.log(`    [${i}] ${d.text}`));
      } else {
        console.log("  ❌ No data in DOM or API");
        const body = await page.evaluate(() => document.body.innerText.slice(0,300)).catch(() => "");
        console.log("  Body:", body);
      }
    }
  } catch (e) {
    console.error("  Error:", e.message);
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POWER BUY — intercept their search API (likely Algolia or internal)
// ═══════════════════════════════════════════════════════════════════════════════
async function testPowerBuy(kw) {
  console.log(`\n${"═".repeat(60)}\n🔵 Power Buy — "${kw}"\n${"═".repeat(60)}`);
  const ctx  = await makeContext();
  const page = await ctx.newPage();
  const captured = [];

  page.on("response", async (resp) => {
    const url = resp.url();
    const ct  = resp.headers()["content-type"] || "";
    if (!ct.includes("json")) return;
    if (!url.includes("powerbuy") && !url.includes("algolia") && !url.includes("algolianet")) return;
    try {
      const json = await resp.json();
      const items = json?.hits || json?.results?.[0]?.hits || json?.data?.products ||
                    json?.products || json?.items || [];
      if (Array.isArray(items) && items.length > 0) {
        captured.push({ url, items });
        console.log(`  [PB API] ${url.slice(0, 80)} — ${items.length} hits`);
        items.slice(0, 5).forEach((it, i) => {
          const name  = it.name || it.title || it.productName || "";
          const price = it.price || it.salePrice || it.specialPrice || it.minPrice || 0;
          const pUrl  = it.url || it.productUrl || it.pdpUrl || "";
          console.log(`    [${i}] ฿${price} "${name.slice(0,60)}" → ${pUrl.slice(0,50)}`);
        });
      }
    } catch {}
  });

  try {
    console.log("[1] Homepage...");
    await page.goto("https://www.powerbuy.co.th/", { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(1500);

    // Try several search URL patterns
    const searchUrls = [
      `https://www.powerbuy.co.th/en/search/${encodeURIComponent(kw)}`,
      `https://www.powerbuy.co.th/search?q=${encodeURIComponent(kw)}`,
    ];
    let tried = false;
    for (const su of searchUrls) {
      if (tried && captured.length > 0) break;
      console.log(`[2] Search: ${su}`);
      await page.goto(su, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
      await scrollDown(page, 6);
      await page.waitForTimeout(2000);
      tried = true;
    }

    const title = await page.title().catch(() => "?");
    console.log(`  Page title: "${title.slice(0, 70)}"`);

    if (captured.length === 0) {
      const dom = await page.evaluate(() => {
        const selectors = [
          '[class*="product-card"]', '[class*="ProductCard"]',
          '[class*="product-item"]', '[class*="ProductItem"]',
          '[data-testid*="product"]', '.product', 'li.item'
        ];
        for (const sel of selectors) {
          const found = document.querySelectorAll(sel);
          if (found.length > 2) {
            return Array.from(found).slice(0, 5).map(el => ({
              sel, text: (el.innerText || "").split("\n").filter(Boolean).slice(0,4).join(" | "),
            }));
          }
        }
        return [];
      }).catch(() => []);
      if (dom.length) {
        console.log(`  DOM (${dom[0].sel}): ${dom.length} items`);
        dom.forEach((d, i) => console.log(`    [${i}] ${d.text}`));
      } else {
        console.log("  ❌ No DOM data");
        const body = await page.evaluate(() => document.body.innerText.slice(0,400)).catch(() => "");
        console.log("  Body:", body);
      }
    }
  } catch (e) {
    console.error("  Error:", e.message);
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BANANA IT — bnn.in.th
// ═══════════════════════════════════════════════════════════════════════════════
async function testBanana(kw) {
  console.log(`\n${"═".repeat(60)}\n🍌 Banana IT — "${kw}"\n${"═".repeat(60)}`);
  const ctx  = await makeContext();
  const page = await ctx.newPage();
  const captured = [];

  page.on("response", async (resp) => {
    const url = resp.url();
    const ct  = resp.headers()["content-type"] || "";
    if (!ct.includes("json")) return;
    if (!url.includes("bnn.in.th") && !url.includes("algolia")) return;
    try {
      const json = await resp.json();
      const items = json?.hits || json?.results?.[0]?.hits || json?.data?.products ||
                    json?.products || json?.items || json?.data || [];
      if (Array.isArray(items) && items.length > 0) {
        captured.push({ url, items });
        console.log(`  [BN API] ${url.slice(0, 80)} — ${items.length} hits`);
        items.slice(0, 5).forEach((it, i) => {
          const name  = it.name || it.title || it.product_name || "";
          const price = it.price || it.sale_price || it.special_price || 0;
          const pUrl  = it.url || it.product_url || it.link || "";
          console.log(`    [${i}] ฿${price} "${name.slice(0,60)}" → ${pUrl.slice(0,50)}`);
        });
      }
    } catch {}
  });

  try {
    console.log("[1] Homepage...");
    await page.goto("https://www.bnn.in.th/", { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(1500);

    const searchUrls = [
      `https://www.bnn.in.th/en/search?keyword=${encodeURIComponent(kw)}`,
      `https://www.bnn.in.th/search?keyword=${encodeURIComponent(kw)}`,
      `https://www.bnn.in.th/en/search/${encodeURIComponent(kw)}`,
    ];
    for (const su of searchUrls) {
      console.log(`[2] Trying: ${su}`);
      const resp = await page.goto(su, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => null);
      if (resp && resp.status() < 400) { break; }
    }
    await scrollDown(page, 6);
    await page.waitForTimeout(2000);

    const title = await page.title().catch(() => "?");
    console.log(`  Page title: "${title.slice(0, 70)}"`);
    console.log(`  URL: ${page.url()}`);

    if (captured.length === 0) {
      const dom = await page.evaluate(() => {
        const selectors = [
          '[class*="product"]', '[class*="Product"]',
          '.card', '.item', '[class*="card"]', 'article',
        ];
        for (const sel of selectors) {
          const found = document.querySelectorAll(sel);
          if (found.length > 2) {
            return Array.from(found).slice(0, 5).map(el => ({
              sel, text: (el.innerText || "").split("\n").filter(Boolean).slice(0,4).join(" | "),
            }));
          }
        }
        return [];
      }).catch(() => []);
      if (dom.length) {
        console.log(`  DOM (${dom[0].sel}): ${dom.length} items`);
        dom.forEach((d, i) => console.log(`    [${i}] ${d.text.slice(0,100)}`));
      } else {
        console.log("  ❌ No DOM data");
        const body = await page.evaluate(() => document.body.innerText.slice(0,400)).catch(() => "");
        console.log("  Body:", body);
      }
    }
  } catch (e) {
    console.error("  Error:", e.message);
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CENTRAL ONLINE — central.co.th
// ═══════════════════════════════════════════════════════════════════════════════
async function testCentral(kw) {
  console.log(`\n${"═".repeat(60)}\n🏬 Central Online — "${kw}"\n${"═".repeat(60)}`);
  const ctx  = await makeContext();
  const page = await ctx.newPage();
  const captured = [];

  page.on("response", async (resp) => {
    const url = resp.url();
    const ct  = resp.headers()["content-type"] || "";
    if (!ct.includes("json")) return;
    if (!url.includes("central") && !url.includes("algolia") && !url.includes("algolianet")) return;
    try {
      const json = await resp.json();
      const items = json?.hits || json?.results?.[0]?.hits ||
                    json?.data?.products || json?.products ||
                    json?.result?.products || json?.items || [];
      if (Array.isArray(items) && items.length > 0) {
        captured.push({ url, items });
        console.log(`  [CT API] ${url.slice(0, 80)} — ${items.length} hits`);
        items.slice(0, 5).forEach((it, i) => {
          const name  = it.name || it.title || it.display_name || it.product_name || "";
          const price = it.price || it.sale_price || it.unit_price || 0;
          const pUrl  = it.url || it.product_url || it.pdp_url || "";
          console.log(`    [${i}] ฿${price} "${name.slice(0,60)}" → ${pUrl.slice(0,50)}`);
        });
      }
    } catch {}
  });

  try {
    console.log("[1] Homepage...");
    await page.goto("https://www.central.co.th/", { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(1500);

    const searchUrls = [
      `https://www.central.co.th/en/search/results/${encodeURIComponent(kw)}`,
      `https://www.central.co.th/en/search?q=${encodeURIComponent(kw)}`,
    ];
    for (const su of searchUrls) {
      console.log(`[2] Trying: ${su}`);
      const resp = await page.goto(su, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null);
      if (resp && resp.status() < 400) { break; }
    }
    await scrollDown(page, 6);
    await page.waitForTimeout(2000);

    const title = await page.title().catch(() => "?");
    console.log(`  Page title: "${title.slice(0, 70)}"`);
    console.log(`  URL: ${page.url()}`);

    if (captured.length === 0) {
      const dom = await page.evaluate(() => {
        const selectors = [
          '[class*="product-card"]', '[class*="ProductCard"]',
          '[class*="product"]', '[class*="Product"]',
          '.card', 'article', '[data-testid]',
        ];
        for (const sel of selectors) {
          const found = document.querySelectorAll(sel);
          if (found.length > 2) {
            return Array.from(found).slice(0, 5).map(el => ({
              sel, text: (el.innerText || "").split("\n").filter(Boolean).slice(0,4).join(" | "),
            }));
          }
        }
        return [];
      }).catch(() => []);
      if (dom.length) {
        console.log(`  DOM (${dom[0].sel}): ${dom.length} items`);
        dom.forEach((d, i) => console.log(`    [${i}] ${d.text.slice(0,100)}`));
      } else {
        console.log("  ❌ No DOM data");
        const body = await page.evaluate(() => document.body.innerText.slice(0,400)).catch(() => "");
        console.log("  Body:", body);
      }
    }
  } catch (e) {
    console.error("  Error:", e.message);
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────────
console.log(`\n🧪 Testing stores: ${store} | keyword: "${keyword}"\n`);
if (store === "jd"       || store === "all") await testJD(keyword);
if (store === "powerbuy" || store === "all") await testPowerBuy(keyword);
if (store === "banana"   || store === "all") await testBanana(keyword);
if (store === "central"  || store === "all") await testCentral(keyword);

await browser.close().catch(() => {});
console.log("\n✅ Done");
