import { chromium } from "playwright";
import type { ScrapedItem } from "./shopee.js";

/**
 * Scrape Central Online Thailand (central.co.th).
 *
 * Strategy:
 *  1. Navigate to search: /en/search?q={keyword}
 *  2. Intercept Next.js data API (/_next/data/.../en/search.json?q=...) or
 *     Central's internal product search REST endpoint.
 *  3. DOM fallback — parse [class*="ProductCard"] elements.
 *
 * Products carried: electronics, fashion, home goods, beauty, sports (general dept. store).
 */
export async function scrapeCentral(keyword: string): Promise<ScrapedItem[]> {
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
    extraHTTPHeaders: {
      "accept-language": "en-US,en;q=0.9,th;q=0.8",
    },
  });

  const page    = await context.newPage();
  const results: ScrapedItem[] = [];

  try {
    const searchUrl = `https://www.central.co.th/en/search?q=${encodeURIComponent(keyword)}`;
    let capturedProducts: any[] = [];

    // ── Intercept Central's JSON product data ─────────────────────────────────
    page.on("response", async (resp) => {
      const url = resp.url();
      if (
        resp.status() === 200 &&
        capturedProducts.length === 0 &&
        (
          // Next.js ISR/SSR data
          (url.includes("/_next/data/") && url.includes("search")) ||
          // Central's own product search API
          url.includes("central.co.th/api/") ||
          url.includes("central.co.th/v") && url.includes("search") ||
          // Elastic/Algolia/product feed
          (url.includes("central") && url.includes("product") && url.endsWith(".json"))
        )
      ) {
        try {
          const data = await resp.json();
          // Try common paths in Central's API response structure
          const prods: any[] =
            data?.pageProps?.products?.items ??
            data?.pageProps?.searchResults?.products ??
            data?.data?.products?.items ??
            data?.products?.items ??
            data?.items ??
            data?.results ??
            [];
          if (prods.length > 0 && capturedProducts.length === 0) {
            capturedProducts = prods;
            console.log(`[Central] API captured ${prods.length} items`);
          }
        } catch { /* freed */ }
      }
    });

    console.log(`[Central] Searching "${keyword}"...`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 35_000 });

    // ── Try __NEXT_DATA__ (SSR path) ─────────────────────────────────────────
    if (capturedProducts.length === 0) {
      const ssrData = await page.evaluate(() => {
        try {
          const nd = (window as any).__NEXT_DATA__;
          return (
            nd?.props?.pageProps?.products?.items ??
            nd?.props?.pageProps?.searchResults?.products ??
            []
          );
        } catch { return []; }
      }).catch(() => [] as any[]);

      if (ssrData.length > 0) {
        capturedProducts = ssrData;
        console.log(`[Central] SSR __NEXT_DATA__ captured ${ssrData.length} items`);
      }
    }

    // Scroll to trigger lazy loads / XHR batches
    for (let y = 0; y <= 2_000; y += 300) {
      try { await page.evaluate((s) => window.scrollTo(0, s), y); } catch { break; }
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(2_000);

    // ── Parse API results ─────────────────────────────────────────────────────
    if (capturedProducts.length > 0) {
      for (const item of capturedProducts.slice(0, 15)) {
        const name = String(
          item.name ?? item.title ?? item.displayName ?? item.productName ?? ""
        ).trim();

        // Central may return price as number or as object {value, currency}
        const priceVal =
          item.price?.value ??
          item.salePrice ??
          item.promotionPrice ??
          item.currentPrice ??
          item.price ??
          0;
        const price = Math.round(parseFloat(String(priceVal).replace(/[^0-9.]/g, "")) || 0);
        if (!name || !price) continue;

        const slug   = item.slug ?? item.url ?? item.permalink ?? "";
        const sku    = item.sku ?? item.id ?? "";
        const url    = slug
          ? slug.startsWith("http") ? slug : `https://www.central.co.th/en/${slug.replace(/^\//, "")}`
          : sku
          ? `https://www.central.co.th/en/p/${sku}`
          : searchUrl;

        // Image: try several common API field names
        const imgRaw =
          item.image ?? item.thumbnail ?? item.imageUrl ??
          item.productImage ?? item.images?.[0] ?? "";
        const image = imgRaw
          ? (imgRaw.startsWith("//") ? `https:${imgRaw}` : imgRaw)
          : undefined;

        results.push({
          name,
          price,
          url,
          inStock: item.inStock !== false && item.available !== false,
          rating:  parseFloat(item.rating ?? "0") || 0,
          reviews: parseInt(item.reviewCount ?? item.reviews ?? "0") || 0,
          image,
        });
      }
    }

    // ── DOM fallback ─────────────────────────────────────────────────────────
    if (results.length === 0) {
      console.log("[Central] API empty — trying DOM...");

      const domItems = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll(
          "[class*='ProductCard'], [class*='product-card'], " +
          "[class*='product-item'], [class*='ProductItem'], " +
          "[data-testid*='product'], .product-card"
        ));

        return cards.slice(0, 15).map((card) => {
          const nameEl  = card.querySelector(
            "[class*='product-name'], [class*='ProductName'], " +
            "[class*='title'], [data-testid*='name'], h2, h3, h4, p[class*='name']"
          );
          const priceEl = card.querySelector(
            "[class*='price'], [class*='Price'], " +
            "[data-testid*='price'], [class*='amount']"
          );
          const linkEl  = card.querySelector("a[href]") as HTMLAnchorElement | null;

          const name     = nameEl?.textContent?.trim().replace(/\s+/g, " ") ?? "";
          const priceStr = (priceEl?.textContent ?? "").replace(/[^0-9]/g, "");
          const price    = parseInt(priceStr, 10) || 0;
          const url      = linkEl?.href ?? "";
          const imgEl    = card.querySelector("img") as HTMLImageElement | null;
          const image    = imgEl?.src || imgEl?.getAttribute("data-src") || "";

          return { name, price, url, image };
        });
      }).catch(() => []);

      for (const item of domItems) {
        if (item.name && item.price > 0) {
          const image = item.image && item.image.startsWith("http") ? item.image : undefined;
          results.push({
            name:    item.name,
            price:   item.price,
            url:     item.url || searchUrl,
            inStock: true,
            rating:  0,
            reviews: 0,
            image,
          });
        }
      }

      if (results.length === 0) {
        const title = await page.title().catch(() => "?");
        console.log(`[Central] No results — page: "${title.slice(0, 60)}"`);
      }
    }

  } catch (err) {
    console.error(`[Central] Error "${keyword}":`, (err as Error).message);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    console.log("[Central] Browser closed");
  }

  console.log(`[Central] "${keyword}" → ${results.length} results`);
  return results;
}
