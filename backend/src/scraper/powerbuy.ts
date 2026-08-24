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
export async function scrapePowerBuy(keyword: string): Promise<ScrapedItem[]> {
  const browser = await chromium.launch({
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1366,768",
      "--window-position=-8000,-8000", // off-screen but not hidden from Cloudflare checks
      "--lang=th-TH",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  const context = await browser.newContext({
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

  const page    = await context.newPage();
  const results: ScrapedItem[] = [];

  try {
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

      for (const item of capturedProducts.slice(0, 12)) {
        const name  = item.name ?? "";
        // minPrice/maxPrice are strings like "49,700.00" — strip commas first
        const price = toPrice(item.minPrice) || toPrice(item.maxPrice) ||
                      Math.round(item.priceSort ?? 0);
        if (!name || !price) continue;

        // Power Buy product URL format: /th/product/{slugname}
        // The prCode is already embedded inside the slug (e.g. "APPLE-iPhone-16-128GB-White-301010")
        // so appending it again as /prCode creates a 404.
        const slug = item.slugname ?? "";
        const url  = slug
          ? `https://www.powerbuy.co.th/th/product/${slug}`
          : searchUrl;

        results.push({
          name,
          price,
          url,
          inStock: item.instock !== false && (item.stockAmount ?? 1) > 0,
          rating:  parseFloat(item.rating       ?? "0") || 0,
          reviews: parseInt(item.reviewCount ?? item.ratingCount ?? "0") || 0,
        });
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
            inStock: true,
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

  } catch (err) {
    console.error(`[PowerBuy] Error "${keyword}":`, (err as Error).message);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    console.log("[PowerBuy] Browser closed");
  }

  console.log(`[PowerBuy] "${keyword}" → ${results.length} results`);
  return results;
}
