import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { ScrapedItem } from "./shopee.js";

// Stealth patches — same setup that bypasses Cloudflare in smoke test
chromium.use(StealthPlugin());

/**
 * Scrape Power Buy Thailand.
 *
 * Strategy:
 *  1. Homepage warm-up for cookies/session.
 *  2. Navigate to /th/search/{keyword} — triggers Next.js data fetch.
 *  3. Intercept /_next/data/.../th/search/*.json
 *     → pageProps.productListData.products[].
 *  4. DOM fallback with [class*="ProductCard"] if API not intercepted.
 *
 * Uses its own browser instance (playwright-extra + StealthPlugin) because
 * Power Buy uses Cloudflare Bot Management which detects the shared singleton.
 * Product API keys: name, minPrice, maxPrice, slugname, prCode, sku, brand
 * Product URL:      https://www.powerbuy.co.th/th/product/{slugname}
 *                   (prCode is already embedded inside the slug — do NOT append it again)
 */
export interface PowerBuyScrapeResult {
  items: ScrapedItem[];
  confirmed: boolean; // true = Power Buy page loaded OK; 0 items = genuinely not sold there
}

// ── Relevance scoring ─────────────────────────────────────────────────────────
//
// Power Buy's internal product names often differ from consumer marketing names
// (e.g. "iPad A16 Gen 11" instead of "iPad Air 6"). This scorer lets us rank
// and filter results so only items that actually match the search keyword are
// shown, removing noise from unrelated products Power Buy bundles into results.
//
// Algorithm:
//  1. Tokenise both query and product name at alphanumeric boundaries
//     ("air6" → ["air","6"], "iphone17" → ["iphone","17"]).
//  2. For numeric tokens require a whole-number match (so "6" won't match "16").
//  3. Return the fraction of query tokens found in the product name.
//
function relevanceScore(productName: string, query: string): number {
  const tokenise = (s: string): string[] =>
    s.toLowerCase()
      .replace(/([a-z])(\d)/g, "$1 $2")   // split letter-digit: "air6" → "air 6"
      .replace(/(\d)([a-z])/g, "$1 $2")   // split digit-letter: "6th" → "6 th"
      .split(/[\s\-_/()+,]+/)
      .filter((t) => t.length >= 2);

  const qTokens = tokenise(query);
  if (qTokens.length === 0) return 1;

  const normName = productName.toLowerCase()
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2");

  let matches = 0;
  for (const t of qTokens) {
    if (/^\d+$/.test(t)) {
      // Whole-number: "6" must not be inside "16" or "60"
      if (new RegExp(`(?<![\\d])${t}(?![\\d])`).test(normName)) matches++;
    } else {
      if (normName.includes(t)) matches++;
    }
  }
  return matches / qTokens.length;
}

// ── Accessory guard ───────────────────────────────────────────────────────────
//
// Power Buy mixes accessories (cases, screen films, cables) into device searches
// because the accessory name contains the device name (e.g. "เคสสำหรับ iPhone 17").
// When the query is for a device (not an accessory), skip accessory-looking items.
//
const ACCESSORY_STARTS_TH = ["ฟิล์ม", "เคส", "สาย", "ที่ชาร์จ", "แท่นชาร์จ", "กระเป๋า", "ขาตั้ง", "จุกอุด"];
const ACCESSORY_STARTS_EN = ["film ", "case ", "cover ", "screen ", "cable ", "charger ", "protector ", "stand ", "holder ", "skin "];

function isAccessory(productName: string): boolean {
  const n  = productName.toLowerCase();
  return (
    ACCESSORY_STARTS_TH.some((p) => productName.startsWith(p)) ||
    ACCESSORY_STARTS_EN.some((p) => n.startsWith(p))
  );
}

function queryIsForAccessory(query: string): boolean {
  const q = query.toLowerCase();
  return (
    ACCESSORY_STARTS_TH.some((p) => q.includes(p.trim())) ||
    ACCESSORY_STARTS_EN.some((p) => q.includes(p.trim()))
  );
}

export async function scrapePowerBuy(keyword: string): Promise<PowerBuyScrapeResult> {
  let browser: import("playwright").Browser | undefined;
  let context: import("playwright").BrowserContext | undefined;
  const results: ScrapedItem[] = [];

  try {
    // ── Browser launch — headed first, headless fallback if no X display ────
    const LAUNCH_ARGS = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1366,768",
      "--lang=th-TH",
    ];
    try {
      browser = await chromium.launch({
        headless: false,
        args: [...LAUNCH_ARGS, "--window-position=-8000,-8000"],
        ignoreDefaultArgs: ["--enable-automation"],
      }) as unknown as import("playwright").Browser;
      console.log("[PowerBuy] Browser launched (headed)");
    } catch {
      console.warn("[PowerBuy] Headed mode failed — falling back to headless");
      browser = await chromium.launch({
        headless: true,
        args: LAUNCH_ARGS,
        ignoreDefaultArgs: ["--enable-automation"],
      }) as unknown as import("playwright").Browser;
      console.log("[PowerBuy] Browser launched (headless fallback)");
    }

    context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      locale: "th-TH",
      timezoneId: "Asia/Bangkok",
      viewport: { width: 1366, height: 768 },
      extraHTTPHeaders: {
        "accept-language": "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7",
        "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
      },
    });

    const page = await context.newPage();

    // ── 1. Homepage warm-up ─────────────────────────────────────────────────
    console.log("[PowerBuy] Visiting homepage...");
    await page.goto("https://www.powerbuy.co.th/th", {
      waitUntil: "domcontentloaded",
      timeout:   25_000,
    });
    await page.waitForTimeout(2_000);

    // ── 2. Register Next.js data-API listener BEFORE navigation ─────────────
    // Power Buy uses Next.js i18n routing:
    //   browser URL → /th/search/{keyword}
    //   _next/data  → /_next/data/{BUILD_ID}/th/search/{keyword}.json
    //                  └── pageProps.productListData.products[50]
    const searchUrl = `https://www.powerbuy.co.th/th/search/${encodeURIComponent(keyword)}`;
    let capturedProducts: any[] = [];

    page.on("response", async (resp) => {
      const url = resp.url();
      if (
        resp.status() === 200 &&
        url.includes("/_next/data/") &&
        url.includes("/search/") &&
        url.includes(".json")
      ) {
        try {
          const data     = await resp.json();
          const products: any[] = data?.pageProps?.productListData?.products ?? [];
          if (products.length > 0 && capturedProducts.length === 0) {
            capturedProducts = products;
            console.log(`[PowerBuy] API captured ${products.length} items`);
          }
        } catch { /* body freed */ }
      }
    });

    // ── 3. Navigate to search page ──────────────────────────────────────────
    console.log(`[PowerBuy] Searching "${keyword}"...`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Scroll to trigger any lazy-loaded batches / _next/data prefetches
    for (let y = 0; y <= 1_500; y += 300) {
      try { await page.evaluate((s) => window.scrollTo(0, s), y); } catch { break; }
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(1_500);

    // ── 3b. Read SSR data from __NEXT_DATA__ (direct URL → no XHR) ──────────
    // Direct page.goto() triggers SSR; product data is embedded in __NEXT_DATA__
    // Client-side navigation (search box) triggers _next/data XHR instead.
    if (capturedProducts.length === 0) {
      const ssrProducts = await page.evaluate(() => {
        try {
          const nd = (window as any).__NEXT_DATA__;
          return nd?.props?.pageProps?.productListData?.products ?? [];
        } catch { return []; }
      }).catch(() => [] as any[]);

      if (ssrProducts.length > 0) {
        capturedProducts = ssrProducts;
        console.log(`[PowerBuy] SSR __NEXT_DATA__ captured ${ssrProducts.length} items`);
      }
    }

    // ── 4. Parse API results ────────────────────────────────────────────────
    if (capturedProducts.length > 0) {
      // Helper: strip Thai thousand-separator commas before parsing
      const toPrice = (v: any) =>
        Math.round(parseFloat(String(v ?? "0").replace(/,/g, "")) || 0);

      // Parse a larger pool first, then score + filter for relevance.
      // Power Buy returns its own ranking order which may include tangentially
      // related products; we re-rank by how well the name matches the keyword.
      const pool: Array<ScrapedItem & { _score: number }> = [];

      for (const item of capturedProducts.slice(0, 40)) {
        const name  = item.name ?? "";
        const price = toPrice(item.minPrice) || toPrice(item.maxPrice) ||
                      Math.round(item.priceSort ?? 0);
        if (!name || !price) continue;

        const slug = item.slugname ?? "";
        const url  = slug
          ? `https://www.powerbuy.co.th/th/product/${slug}`
          : searchUrl;

        const score = relevanceScore(name, keyword);

        pool.push({
          name,
          price,
          url,
          inStock: item.instock !== false && (item.stockAmount ?? 1) > 0,
          rating:  parseFloat(item.rating       ?? "0") || 0,
          reviews: parseInt(item.reviewCount ?? item.ratingCount ?? "0") || 0,
          _score:  score,
        });
      }

      // ── Step 1: accessory guard ───────────────────────────────────────────
      // When the query is for a device, strip out cases/films/cables that
      // Power Buy bundles into the results because they mention the device name.
      const searchingForAccessory = queryIsForAccessory(keyword);
      const nonAccessory = searchingForAccessory
        ? pool
        : pool.filter((p) => !isAccessory(p.name));

      // ── Step 2: relevance threshold ───────────────────────────────────────
      const minScore = 0.5;
      const relevant = nonAccessory.filter((p) => p._score >= minScore);

      // ── Step 3: de-duplicate by name (colour/variant differences kept) ────
      // Power Buy sometimes lists the same SKU multiple times (different
      // promotion slots). Deduplicate on normalised name + price.
      const seen = new Set<string>();
      const deduped = relevant.filter((p) => {
        const key = `${p.name.toLowerCase().replace(/\s+/g, "")}::${p.price}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // ── Step 4: sort best-match first, then cheapest ──────────────────────
      deduped.sort((a, b) => b._score - a._score || a.price - b.price);

      if (deduped.length === 0 && pool.length > 0) {
        // All items filtered — fall back to top 5 unfiltered so we never
        // silently return nothing for a valid keyword.
        console.log(`[PowerBuy] All ${pool.length} items filtered — showing top 5 unfiltered fallback`);
        const fallback = pool.slice(0, 5);
        results.push(...fallback.map(({ _score: _s, ...item }) => item));
      } else {
        results.push(...deduped.slice(0, 10).map(({ _score: _s, ...item }) => item));
        console.log(
          `[PowerBuy] Filter: ${pool.length} raw → ${nonAccessory.length} non-accessory ` +
          `→ ${relevant.length} relevant → ${deduped.length} deduped → showing ${results.length}`
        );
      }
    }

    // ── 5. DOM fallback ─────────────────────────────────────────────────────
    if (results.length === 0) {
      console.log("[PowerBuy] API empty — trying DOM...");
      await page.waitForTimeout(2_000);

      const domItems = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll(
          '[class*="ProductCard"],[class*="product-card"],[class*="product-item"]'
        ));
        return cards.slice(0, 12).map((card) => {
          const el      = card as HTMLElement;
          const nameEl  = el.querySelector('[class*="name"],[class*="Name"],h3,h4,[class*="title"]');
          const priceEl = el.querySelector('[class*="price"],[class*="Price"]');
          const link    = (el.querySelector("a") as HTMLAnchorElement | null)?.href ?? "";
          const name    = nameEl?.textContent?.trim() ?? "";
          const rawPx   = (priceEl?.textContent ?? "").replace(/[^0-9.]/g, "");
          const price   = Math.round(parseFloat(rawPx) || 0);
          return { name, price, link };
        });
      }).catch(() => [] as { name: string; price: number; link: string }[]);

      for (const item of domItems) {
        if (item.name && item.price > 0) {
          results.push({
            name:    item.name,
            price:   item.price,
            url:     item.link || searchUrl,
            inStock: null,
            rating:  0,
            reviews: 0,
          });
        }
      }

      if (results.length === 0) {
        const title = await page.title().catch(() => "?");
        console.log(`[PowerBuy] DOM empty — page: "${title.slice(0, 60)}"`);
      }
    }

    // ── Page validity check ─────────────────────────────────────────────────
    // If we're still on powerbuy.co.th AND __NEXT_DATA__ is present (even if
    // product list is empty), the page loaded legitimately → confirmed = true.
    // A Cloudflare challenge page would redirect us off-domain or omit __NEXT_DATA__.
    const finalUrl    = page.url();
    const hasNextData = await page.evaluate(() => {
      try { return !!(window as any).__NEXT_DATA__; } catch { return false; }
    }).catch(() => false);

    const confirmed = finalUrl.includes("powerbuy.co.th") && hasNextData;
    if (!confirmed) {
      console.warn(
        `[PowerBuy] Page validity check failed — ` +
        `url="${finalUrl.slice(0, 80)}" hasNextData=${hasNextData}`
      );
    }

    if (results.length === 0 && confirmed) {
      console.log(`[PowerBuy] Confirmed page loaded but no results for "${keyword}"`);
    }

    return { items: results, confirmed };

  } catch (err) {
    console.error(`[PowerBuy] Error "${keyword}":`, (err as Error).message);
    return { items: results, confirmed: false };
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    console.log("[PowerBuy] Browser closed");
  }
}
