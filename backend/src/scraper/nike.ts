import { chromium } from "playwright";
import type { ScrapedItem } from "./shopee.js";

/**
 * Scrape Nike Thailand (nike.com/th).
 *
 * Strategy:
 *  1. Fetch Nike's product feed REST API directly (fast, no browser):
 *       https://api.nike.com/product_feed/threads/v2/
 *         ?filter=marketplace(TH)
 *         &filter=language(en-GB)
 *         &filter=channelId(d9a5bc42-4b9c-4976-858a-f159cf99c647)
 *         &filter=searchTerms({keyword})
 *         &anchor=0&count=24
 *  2. Playwright DOM fallback on nike.com/th/search?q={keyword}
 *
 * Products carried: running shoes, training shoes, lifestyle shoes, sportswear.
 * Nike product names are always in English, matching well with product.name.
 */

const NIKE_CHANNEL_ID = "d9a5bc42-4b9c-4976-858a-f159cf99c647"; // Nike.com TH web channel

// ── Approach 1: Nike Product Feed API ─────────────────────────────────────────
async function fetchNikeApi(keyword: string): Promise<ScrapedItem[]> {
  const params = new URLSearchParams({
    "filter": `marketplace(TH)`,
    "anchor":  "0",
    "count":   "24",
  });
  // Nike API uses multiple filter params with the same key — URLSearchParams deduplicates
  // so we build the URL manually:
  const apiUrl =
    `https://api.nike.com/product_feed/threads/v2/` +
    `?filter=marketplace(TH)` +
    `&filter=language(en-GB)` +
    `&filter=channelId(${NIKE_CHANNEL_ID})` +
    `&filter=searchTerms(${encodeURIComponent(keyword)})` +
    `&anchor=0&count=24&sort=relevance`;

  const resp = await fetch(apiUrl, {
    headers: {
      "User-Agent":  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept":      "application/json",
      "Referer":     "https://www.nike.com/",
      "Origin":      "https://www.nike.com",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const data = await resp.json();
  const threads: any[] = data?.objects ?? [];

  const results: ScrapedItem[] = [];

  for (const thread of threads.slice(0, 20)) {
    // Each thread can have multiple "products" (colorways)
    const productCards: any[] = thread?.publishedContent?.properties?.productCard?.properties ?? [];
    const threadTitle = thread?.publishedContent?.properties?.coverCard?.properties?.title ??
                        thread?.publishedContent?.properties?.title ?? "";

    // Fallback: grab product info from productsInfo
    const productsInfo: any[] = thread?.productsInfo ?? [];

    if (productsInfo.length > 0) {
      for (const pi of productsInfo.slice(0, 2)) {
        const name = String(
          pi.fullTitle ?? pi.title ?? pi.colorDescription ?? threadTitle ?? ""
        ).trim();
        const price = Math.round(
          parseFloat(String(pi.prices?.currentPrice ?? pi.price ?? "0")) || 0
        );
        if (!name || !price) continue;

        const styleCode = pi.styleCode ?? pi.styleColor ?? "";
        const url = styleCode
          ? `https://www.nike.com/th/t/${encodeURIComponent(name.toLowerCase().replace(/\s+/g, "-"))}/${styleCode}`
          : `https://www.nike.com/th/search?q=${encodeURIComponent(keyword)}`;

        results.push({
          name,
          price,
          url,
          inStock: pi.availability?.available !== false,
          rating:  0,
          reviews: 0,
        });
      }
    } else if (threadTitle) {
      // Try to extract price from the thread-level price range
      const priceRange = thread?.publishedContent?.properties?.priceRange ??
                         thread?.publishedContent?.properties?.price;
      const priceVal   = priceRange?.minPrice ?? priceRange?.currentPrice ?? priceRange ?? 0;
      const price = Math.round(parseFloat(String(priceVal).replace(/[^0-9.]/g, "")) || 0);
      if (!threadTitle || !price) continue;

      results.push({
        name:    threadTitle.trim(),
        price,
        url:     `https://www.nike.com/th/search?q=${encodeURIComponent(keyword)}`,
        inStock: true,
        rating:  0,
        reviews: 0,
      });
    }
  }

  if (results.length === 0) throw new Error("no usable items in API response");
  return results;
}

// ── Approach 2: Playwright DOM fallback ───────────────────────────────────────
async function fetchNikeDom(keyword: string): Promise<ScrapedItem[]> {
  const browser = await chromium.launch({
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1366,768",
      "--window-position=-8000,-8000",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "en-US",
    timezoneId: "Asia/Bangkok",
    viewport: { width: 1366, height: 768 },
  });

  const page    = await context.newPage();
  const results: ScrapedItem[] = [];

  try {
    const searchUrl = `https://www.nike.com/th/search?q=${encodeURIComponent(keyword)}`;
    let capturedProducts: any[] = [];

    // Intercept Nike API calls from the browser
    page.on("response", async (resp) => {
      const url = resp.url();
      if (
        resp.status() === 200 &&
        capturedProducts.length === 0 &&
        (url.includes("api.nike.com/product_feed") ||
          url.includes("nike.com/api/") ||
          (url.includes("nike.com") && url.includes("search") && resp.headers()["content-type"]?.includes("json")))
      ) {
        try {
          const data = await resp.json();
          const objs: any[] = data?.objects ?? data?.products ?? data?.items ?? [];
          if (objs.length > 0) {
            capturedProducts = objs;
            console.log(`[Nike] API captured ${objs.length} items via browser`);
          }
        } catch { /* freed */ }
      }
    });

    console.log(`[Nike] DOM search "${keyword}"...`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 35_000 });

    for (let y = 0; y <= 2_000; y += 300) {
      try { await page.evaluate((s) => window.scrollTo(0, s), y); } catch { break; }
      await page.waitForTimeout(350);
    }
    await page.waitForTimeout(2_500);

    // If browser API call succeeded
    if (capturedProducts.length > 0) {
      for (const obj of capturedProducts.slice(0, 15)) {
        const name  = String(obj.fullTitle ?? obj.title ?? obj.name ?? "").trim();
        const price = Math.round(
          parseFloat(String(
            obj.prices?.currentPrice ?? obj.price ?? obj.priceRange?.minPrice ?? "0"
          ).replace(/[^0-9.]/g, "")) || 0
        );
        if (!name || !price) continue;
        results.push({
          name, price,
          url:     `https://www.nike.com/th/search?q=${encodeURIComponent(keyword)}`,
          inStock: true,
          rating:  0,
          reviews: 0,
        });
      }
    }

    // DOM parsing
    if (results.length === 0) {
      const domItems = await page.evaluate(() => {
        // Nike product cards
        const cards = Array.from(document.querySelectorAll(
          "[class*='product-card'], [data-testid='product-card'], " +
          "[class*='ProductCard'], .product-card__body, " +
          "[class*='card-body']"
        ));

        return cards.slice(0, 15).map((card) => {
          const nameEl  = card.querySelector(
            "[class*='product-card__title'], [class*='product-card__subtitle'], " +
            "[class*='product-name'], h2, h3, [data-testid='product-name']"
          );
          const priceEl = card.querySelector(
            "[class*='product-price'], [class*='ProductPrice'], " +
            "[data-testid='product-price'], [class*='price']"
          );
          const linkEl  = card.querySelector("a[href]") as HTMLAnchorElement | null;

          const name     = nameEl?.textContent?.trim().replace(/\s+/g, " ") ?? "";
          const priceStr = (priceEl?.textContent ?? "").replace(/[^0-9]/g, "");
          const price    = parseInt(priceStr, 10) || 0;
          const url      = linkEl?.href ?? "";

          return { name, price, url };
        });
      }).catch(() => []);

      for (const item of domItems) {
        if (item.name && item.price > 0)
          results.push({ name: item.name, price: item.price, url: item.url || searchUrl,
                         inStock: true, rating: 0, reviews: 0 });
      }

      if (results.length === 0) {
        const title = await page.title().catch(() => "?");
        console.log(`[Nike] No results — page: "${title.slice(0, 60)}"`);
      }
    }

  } catch (err) {
    console.error(`[Nike] DOM error "${keyword}":`, (err as Error).message);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    console.log("[Nike] Browser closed");
  }

  return results;
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function scrapeNike(keyword: string): Promise<ScrapedItem[]> {
  // Fast path: Nike product feed API
  const apiResults = await fetchNikeApi(keyword).catch((e) => {
    console.warn(`[Nike] API fetch failed ("${keyword}"):`, e.message);
    return [] as ScrapedItem[];
  });

  if (apiResults.length > 0) {
    console.log(`[Nike] "${keyword}" → ${apiResults.length} results (API)`);
    return apiResults;
  }

  // Slow path: Playwright DOM
  const domResults = await fetchNikeDom(keyword);
  console.log(`[Nike] "${keyword}" → ${domResults.length} results (DOM)`);
  return domResults;
}
