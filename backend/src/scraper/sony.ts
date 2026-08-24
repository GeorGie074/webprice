import { chromium } from "playwright";
import type { ScrapedItem } from "./shopee.js";

/**
 * Scrape Sony Store Thailand (store.sony.co.th — Shopify Plus).
 *
 * Strategy:
 *  1. Shopify Predictive Search JSON API (fast, no browser): /search/suggest.json
 *  2. Playwright DOM fallback on /search?q={keyword}&type=product
 *
 * Products carried: Xperia phones, WH/WF headphones, cameras, ZV camcorders,
 *                   Bravia TVs, PlayStation accessories.
 *
 * Shopify price format: string in store currency (THB) — e.g. "10990.00"
 */

const BASE_URL = "https://store.sony.co.th";

// ── Approach 1: Shopify Predictive Search API (no browser needed) ─────────────
async function fetchSonyApi(keyword: string): Promise<ScrapedItem[]> {
  const apiUrl =
    `${BASE_URL}/search/suggest.json?q=${encodeURIComponent(keyword)}` +
    `&resources[type]=product&resources[limit]=20` +
    `&resources[options][unavailable_products]=last` +
    `&resources[options][fields]=title,body,product_type,variants.title`;

  const resp = await fetch(apiUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const data = await resp.json();
  const products: any[] = data?.resources?.results?.products ?? [];
  if (products.length === 0) throw new Error("empty suggest.json");

  return products
    .slice(0, 15)
    .filter((p) => p.title && p.price)
    .map((p) => {
      const name  = String(p.title).trim();
      // price is a string like "10990.00" (Thai Baht, NOT satang)
      const price = Math.round(parseFloat(String(p.price).replace(/[^0-9.]/g, "")) || 0);
      const path  = typeof p.url === "string" ? p.url : "";
      const url   = path.startsWith("http") ? path : `${BASE_URL}${path}`;
      return { name, price, url, inStock: p.available !== false, rating: 0, reviews: 0 };
    })
    .filter((r) => r.price > 0);
}

// ── Approach 2: Playwright DOM fallback ───────────────────────────────────────
async function fetchSonyDom(keyword: string): Promise<ScrapedItem[]> {
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
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    viewport: { width: 1366, height: 768 },
  });

  const page    = await context.newPage();
  const results: ScrapedItem[] = [];

  try {
    const searchUrl = `${BASE_URL}/search?q=${encodeURIComponent(keyword)}&type=product`;
    let capturedProducts: any[] = [];

    // Intercept Shopify storefront JSON (search.json / products.json fetches)
    page.on("response", async (resp) => {
      const url = resp.url();
      if (
        resp.status() === 200 &&
        capturedProducts.length === 0 &&
        (url.includes("/search.json") || url.includes("/products.json"))
      ) {
        try {
          const data = await resp.json();
          const prods: any[] = data?.products ?? [];
          if (prods.length > 0) {
            capturedProducts = prods;
            console.log(`[Sony] Shopify JSON captured ${prods.length} products`);
          }
        } catch { /* freed */ }
      }
    });

    console.log(`[Sony] DOM search "${keyword}"...`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

    for (let y = 0; y <= 1_200; y += 300) {
      try { await page.evaluate((s) => window.scrollTo(0, s), y); } catch { break; }
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(1_500);

    // Parse intercepted Shopify JSON
    if (capturedProducts.length > 0) {
      for (const p of capturedProducts.slice(0, 15)) {
        const name  = String(p.title ?? "").trim();
        const price = Math.round(
          parseFloat(String(p.variants?.[0]?.price ?? p.price ?? "0").replace(/[^0-9.]/g, "")) || 0
        );
        if (!name || !price) continue;
        const handle = p.handle ?? "";
        const url    = handle ? `${BASE_URL}/products/${handle}` : searchUrl;
        results.push({ name, price, url, inStock: p.available !== false, rating: 0, reviews: 0 });
      }
    }

    // DOM parsing (Shopify standard selectors)
    if (results.length === 0) {
      const domItems = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll(
          ".grid-product, .grid__item, .product-card, " +
          "[class*='ProductCard'], [class*='product-item']"
        ));

        return cards.slice(0, 15).map((card) => {
          const nameEl  = card.querySelector(
            ".grid-product__title, .card__heading, .card__title, " +
            "[class*='product-name'], h2, h3, h4"
          );
          const priceEl = card.querySelector(
            ".price, .price__current, .price-item--regular, [class*='price']"
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
        console.log(`[Sony] No results — page: "${title.slice(0, 60)}"`);
      }
    }

  } catch (err) {
    console.error(`[Sony] DOM error "${keyword}":`, (err as Error).message);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    console.log("[Sony] Browser closed");
  }

  return results;
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function scrapeSony(keyword: string): Promise<ScrapedItem[]> {
  // Fast path: Shopify JSON API (no browser)
  const apiResults = await fetchSonyApi(keyword).catch((e) => {
    console.warn(`[Sony] API fetch failed ("${keyword}"):`, e.message);
    return [] as ScrapedItem[];
  });

  if (apiResults.length > 0) {
    console.log(`[Sony] "${keyword}" → ${apiResults.length} results (API)`);
    return apiResults;
  }

  // Slow path: Playwright DOM
  const domResults = await fetchSonyDom(keyword);
  console.log(`[Sony] "${keyword}" → ${domResults.length} results (DOM)`);
  return domResults;
}
