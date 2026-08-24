import { chromium } from "playwright";
import type { ScrapedItem } from "./shopee.js";

/**
 * Scrape Apple Store Thailand (apple.com/th).
 *
 * Strategy:
 *  1. Fetch Apple's internal product search API:
 *       https://www.apple.com/shop/product/search?q={keyword}&form-type=buyButtons
 *     Returns JSON with product listings and prices.
 *  2. Playwright DOM fallback on apple.com/th/search/{keyword}
 *
 * Apple pricing in Thailand:
 *  - Apple sets fixed MSRP prices (never discounted on official store).
 *  - Official Thai Apple Store URL: apple.com/th/shop/...
 *  - Product pages contain machine-readable price data.
 *
 * Products carried: iPhone, MacBook (Air/Pro), iPad, AirPods, Apple Watch.
 */

const BASE_URL = "https://www.apple.com";

// ── Approach 1: Apple's internal shop search API ──────────────────────────────
async function fetchAppleApi(keyword: string): Promise<ScrapedItem[]> {
  // Apple Shop search returns product data in JSON
  const apiUrl =
    `${BASE_URL}/shop/product/search?q=${encodeURIComponent(keyword)}&form-type=buyButtons&branch=&product=all&src=serp`;

  const resp = await fetch(apiUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
        "(KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      Accept:         "application/json, text/javascript, */*",
      "X-Requested-With": "XMLHttpRequest",
      Referer:        "https://www.apple.com/th/shop/",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const data = await resp.json();
  // Apple's response structure varies — try common paths
  const products: any[] =
    data?.products ??
    data?.data?.products ??
    data?.results ??
    [];

  if (products.length === 0) throw new Error("no products in API response");

  const results: ScrapedItem[] = [];
  const searchFallbackUrl = `${BASE_URL}/th/search/${encodeURIComponent(keyword)}?src=serp`;

  for (const p of products.slice(0, 15)) {
    const name = String(
      p.name ?? p.title ?? p.productTitle ?? ""
    ).trim();

    // Apple price format: may be a string like "฿39,900" or a number
    const priceRaw = p.price?.currentPrice ?? p.price?.value ?? p.price ?? p.currentPrice ?? "0";
    const price = Math.round(parseFloat(String(priceRaw).replace(/[^0-9.]/g, "")) || 0);
    if (!name || !price) continue;

    const partNumber = p.partNumber ?? p.sku ?? "";
    const url = partNumber
      ? `${BASE_URL}/th/shop/product/${partNumber}`
      : p.url ?? searchFallbackUrl;

    results.push({
      name,
      price,
      url: url.startsWith("http") ? url : `${BASE_URL}${url}`,
      inStock: p.available !== false && p.inStock !== false,
      rating:  0,
      reviews: 0,
    });
  }

  if (results.length === 0) throw new Error("no usable items");
  return results;
}

// ── Approach 2: Playwright on apple.com/th/search ─────────────────────────────
async function fetchAppleDom(keyword: string): Promise<ScrapedItem[]> {
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
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
      "(KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    viewport: { width: 1366, height: 768 },
  });

  const page    = await context.newPage();
  const results: ScrapedItem[] = [];

  try {
    // Apple search: /th/search/{keyword}?src=serp
    const encodedKw = encodeURIComponent(keyword).replace(/%20/g, "+");
    const searchUrl  = `${BASE_URL}/th/search/${encodedKw}?src=serp`;

    let capturedItems: any[] = [];

    // Intercept Apple's shop/product search API called by the page's JS
    page.on("response", async (resp) => {
      const url = resp.url();
      if (
        resp.status() === 200 &&
        capturedItems.length === 0 &&
        (url.includes("apple.com/shop/product/search") ||
          url.includes("apple.com/shop/search") ||
          (url.includes("apple.com") && url.includes("/api/") && url.includes("search")))
      ) {
        try {
          const data = await resp.json();
          const prods: any[] = data?.products ?? data?.data?.products ?? data?.results ?? [];
          if (prods.length > 0) {
            capturedItems = prods;
            console.log(`[Apple] API intercepted ${prods.length} items`);
          }
        } catch { /* freed */ }
      }
    });

    console.log(`[Apple] Searching "${keyword}"...`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 35_000 });

    for (let y = 0; y <= 1_800; y += 300) {
      try { await page.evaluate((s) => window.scrollTo(0, s), y); } catch { break; }
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(2_000);

    // ── Parse intercepted API data ────────────────────────────────────────────
    if (capturedItems.length > 0) {
      for (const p of capturedItems.slice(0, 15)) {
        const name = String(p.name ?? p.title ?? p.productTitle ?? "").trim();
        const priceRaw = p.price?.currentPrice ?? p.price?.value ?? p.price ?? p.currentPrice ?? "0";
        const price = Math.round(parseFloat(String(priceRaw).replace(/[^0-9.]/g, "")) || 0);
        if (!name || !price) continue;

        const partNumber = p.partNumber ?? p.sku ?? "";
        const url = partNumber
          ? `${BASE_URL}/th/shop/product/${partNumber}`
          : p.url ?? searchUrl;

        results.push({
          name,
          price,
          url: url.startsWith("http") ? url : `${BASE_URL}${url}`,
          inStock: p.available !== false && p.inStock !== false,
          rating:  0,
          reviews: 0,
        });
      }
    }

    // ── DOM fallback ─────────────────────────────────────────────────────────
    if (results.length === 0) {
      console.log("[Apple] API empty — trying DOM...");

      const domItems = await page.evaluate(() => {
        // Apple search results page structure (rf-serp = search results page)
        const cards = Array.from(document.querySelectorAll(
          ".rf-serp-productlist-item, [class*='serp-product'], " +
          "[data-analytics-s-object-type*='product'], " +
          "[class*='product-tile'], [class*='ProductTile'], " +
          "[class*='plp-tile']"
        ));

        return cards.slice(0, 15).map((card) => {
          const nameEl  = card.querySelector(
            ".rf-serp-productname, [class*='product-name'], " +
            "[class*='product-title'], h2, h3, [class*='title']"
          );
          const priceEl = card.querySelector(
            ".rf-serp-product-price, [class*='price'], " +
            "[class*='Price'], [class*='current-price']"
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
          results.push({
            name:    item.name,
            price:   item.price,
            url:     item.url || searchUrl,
            inStock: true,
            rating:  0,
            reviews: 0,
          });
      }

      if (results.length === 0) {
        const title = await page.title().catch(() => "?");
        console.log(`[Apple] No results — page: "${title.slice(0, 60)}"`);
      }
    }

  } catch (err) {
    console.error(`[Apple] DOM error "${keyword}":`, (err as Error).message);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    console.log("[Apple] Browser closed");
  }

  return results;
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function scrapeApple(keyword: string): Promise<ScrapedItem[]> {
  // Fast path: Apple Shop search API
  const apiResults = await fetchAppleApi(keyword).catch((e) => {
    console.warn(`[Apple] API fetch failed ("${keyword}"):`, e.message);
    return [] as ScrapedItem[];
  });

  if (apiResults.length > 0) {
    console.log(`[Apple] "${keyword}" → ${apiResults.length} results (API)`);
    return apiResults;
  }

  // Slow path: Playwright DOM
  const domResults = await fetchAppleDom(keyword);
  console.log(`[Apple] "${keyword}" → ${domResults.length} results (DOM)`);
  return domResults;
}
