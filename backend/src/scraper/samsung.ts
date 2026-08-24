import { chromium } from "playwright";
import type { ScrapedItem } from "./shopee.js";

/**
 * Scrape Samsung Shop Thailand (samsung.com/th).
 *
 * Strategy:
 *  1. Navigate to samsung.com/th/search/?searchvalue={keyword}
 *  2. Intercept Samsung's internal search API (searchapi.samsung.com or internal JSON)
 *  3. DOM fallback — parse .card-product / .results-category-product elements
 *
 * Products carried: Galaxy phones, tablets, TVs, Galaxy Buds, Galaxy Watch, laptops.
 */
export async function scrapeSamsung(keyword: string): Promise<ScrapedItem[]> {
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
    const searchUrl = `https://www.samsung.com/th/search/?searchvalue=${encodeURIComponent(keyword)}`;
    let capturedItems: any[] = [];

    // ── Intercept Samsung's JSON search API ──────────────────────────────────
    page.on("response", async (resp) => {
      const url = resp.url();
      if (
        resp.status() === 200 &&
        capturedItems.length === 0 &&
        (url.includes("searchapi.samsung.com") ||
          (url.includes("samsung.com") && url.includes("/api/") && url.includes("search")))
      ) {
        try {
          const data = await resp.json();
          // Samsung search API nests results in different keys depending on version
          const hits: any[] =
            data?.hits ??
            data?.results ??
            data?.data?.results ??
            data?.searchresult?.results ??
            [];
          if (Array.isArray(hits) && hits.length > 0) {
            capturedItems = hits;
            console.log(`[Samsung] API captured ${hits.length} items`);
          }
        } catch { /* response body already freed */ }
      }
    });

    console.log(`[Samsung] Searching "${keyword}"...`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 35_000 })
      .catch(() => page.goto(searchUrl, { waitUntil: "load", timeout: 35_000 }).catch(() => {}));

    // Scroll to trigger lazy loads and API fetch
    for (let y = 0; y <= 1_800; y += 300) {
      try { await page.evaluate((s) => window.scrollTo(0, s), y); } catch { break; }
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(2_000);

    // ── Parse captured API data ───────────────────────────────────────────────
    if (capturedItems.length > 0) {
      for (const item of capturedItems.slice(0, 15)) {
        const name = String(
          item.name ?? item.modelName ?? item.title ?? item.displayName ?? ""
        ).trim();
        const priceRaw = String(
          item.priceInclTax ?? item.price ?? item.minPrice ?? item.salePrice ?? "0"
        ).replace(/[^0-9]/g, "");
        const price = parseInt(priceRaw, 10) || 0;
        if (!name || !price) continue;

        const slug =
          item.modelUrlName ?? item.slug ?? item.url ?? item.detailUrl ?? "";
        const url = slug
          ? slug.startsWith("http")
            ? slug
            : `https://www.samsung.com/th/${slug.replace(/^\//, "")}`
          : searchUrl;

        const imgRaw =
          item.thumbnail ?? item.imageUrl ?? item.image ??
          item.mainImage ?? item.thumbnailUrl ?? "";
        const image = imgRaw
          ? (imgRaw.startsWith("//") ? `https:${imgRaw}` : imgRaw)
          : undefined;

        results.push({ name, price, url, inStock: true, rating: 0, reviews: 0, image });
      }
    }

    // ── DOM fallback ─────────────────────────────────────────────────────────
    if (results.length === 0) {
      console.log("[Samsung] API empty — trying DOM...");

      const domItems = await page.evaluate(() => {
        // Samsung's search result page uses several possible card selectors
        const cards = Array.from(document.querySelectorAll(
          ".card-product, .results-category-product, " +
          "[class*='product-card'], [data-component='ProductCard'], " +
          ".txt-product-name, li.result"
        ));

        return cards.slice(0, 15).map((card) => {
          // Name
          const nameEl = card.querySelector(
            ".txt-productname, .txt-model-name, .product-name, " +
            "[class*='product-name'], [class*='modelname'], " +
            "h3, h4, [class*='title']"
          );
          // Price — Samsung shows price with ฿ symbol and comma thousands
          const priceEl = card.querySelector(
            ".price-wrapper, .regular-price, [class*='price'], " +
            "[class*='Price'], .price"
          );
          // URL
          const linkEl = card.querySelector("a[href]") as HTMLAnchorElement | null;

          const name = nameEl?.textContent?.trim().replace(/\s+/g, " ") ?? "";
          // Remove all non-digit chars except commas, then remove commas
          const priceStr = (priceEl?.textContent ?? "").replace(/[^0-9,]/g, "").replace(/,/g, "");
          const price = parseInt(priceStr, 10) || 0;
          const url   = linkEl?.href ?? "";
          const imgEl = card.querySelector("img") as HTMLImageElement | null;
          const image = imgEl?.src || imgEl?.getAttribute("data-src") || "";

          return { name, price, url, image };
        });
      }).catch(() => [] as { name: string; price: number; url: string; image: string }[]);

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
        console.log(`[Samsung] No results — page: "${title.slice(0, 60)}"`);
      }
    }

  } catch (err) {
    console.error(`[Samsung] Error "${keyword}":`, (err as Error).message);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    console.log("[Samsung] Browser closed");
  }

  console.log(`[Samsung] "${keyword}" → ${results.length} results`);
  return results;
}
