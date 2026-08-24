import { chromium } from "playwright";
import type { ScrapedItem } from "./shopee.js";

/**
 * Scrape Dyson Thailand (dyson.co.th).
 *
 * Strategy:
 *  1. Intercept Coveo / Algolia / internal JSON API responses that Dyson's SPA fires.
 *  2. DOM fallback — parse product cards on the category/product listing pages.
 *
 * Products carried: cordless vacuums (V-series), Airwrap, Supersonic hair dryer,
 *                   Purifier fans, Corrale straightener.
 *
 * URL approach:
 *  - Dyson doesn't expose a plain /search?q= endpoint accessible without JS.
 *  - We navigate to the brand site search and capture API responses.
 *  - Fallback: navigate to a category page derived from the keyword.
 */

/** Map keyword tokens → stable Dyson Thailand category pages (lang=en). */
function categoryUrl(keyword: string): string {
  const kl = keyword.toLowerCase();

  if (kl.includes("airwrap") || kl.includes("hair wrap"))
    return "https://www.dyson.co.th/en/hair-care/stylers";
  if (kl.includes("supersonic") || kl.includes("hair dryer") || kl.includes("blow dry"))
    return "https://www.dyson.co.th/en/hair-care/dryers";
  if (kl.includes("corrale") || kl.includes("straightener"))
    return "https://www.dyson.co.th/en/hair-care/straighteners";
  if (kl.includes("v8") || kl.includes("v10") || kl.includes("v11") ||
      kl.includes("v12") || kl.includes("v15") || kl.includes("outsize") ||
      kl.includes("vacuum") || kl.includes("cordless"))
    return "https://www.dyson.co.th/en/vacuum-cleaners/cordless";
  if (kl.includes("purifier") || kl.includes("air purifier") || kl.includes("cool"))
    return "https://www.dyson.co.th/en/air-treatment/air-purifiers";
  if (kl.includes("fan") || kl.includes("hot+cool") || kl.includes("am09"))
    return "https://www.dyson.co.th/en/air-treatment/fans";
  if (kl.includes("humidifier"))
    return "https://www.dyson.co.th/en/air-treatment/humidifiers";

  return "https://www.dyson.co.th/en";
}

export async function scrapeDyson(keyword: string): Promise<ScrapedItem[]> {
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
    locale: "en-US",          // Dyson TH serves English product names on en locale
    timezoneId: "Asia/Bangkok",
    viewport: { width: 1366, height: 768 },
  });

  const page    = await context.newPage();
  const results: ScrapedItem[] = [];

  try {
    const targetUrl = categoryUrl(keyword);
    let capturedItems: any[] = [];

    // ── Intercept Dyson's product / search API ────────────────────────────────
    // Dyson may use Coveo, Algolia, or their own product feed endpoint.
    page.on("response", async (resp) => {
      const url = resp.url();
      if (
        resp.status() === 200 &&
        capturedItems.length === 0 &&
        (url.includes("coveo") ||
          url.includes("algolia") ||
          url.includes("dyson.co.th/api") ||
          url.includes("dyson.co.th/en/product") ||
          (url.includes("dyson") && url.includes("search")))
      ) {
        try {
          const data = await resp.json();
          // Coveo: results[].raw / Algolia: hits[] / custom: products[]
          const items: any[] =
            data?.results ??
            data?.hits ??
            data?.products ??
            data?.data?.products ??
            [];
          if (items.length > 0) {
            capturedItems = items;
            console.log(`[Dyson] API captured ${items.length} items`);
          }
        } catch { /* freed */ }
      }
    });

    console.log(`[Dyson] Navigating to "${targetUrl}"...`);
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 35_000 });

    for (let y = 0; y <= 2_000; y += 300) {
      try { await page.evaluate((s) => window.scrollTo(0, s), y); } catch { break; }
      await page.waitForTimeout(350);
    }
    await page.waitForTimeout(2_000);

    // ── Parse captured API data ───────────────────────────────────────────────
    if (capturedItems.length > 0) {
      for (const item of capturedItems.slice(0, 15)) {
        // Coveo raw fields
        const raw  = item.raw ?? item;
        const name = String(
          raw.displayname ?? raw.name ?? raw.title ?? raw.productName ?? item.name ?? ""
        ).trim();
        const priceRaw = String(
          raw.price ?? raw.pricevalue ?? raw.salesprice ?? item.price ?? "0"
        ).replace(/[^0-9.]/g, "");
        const price = Math.round(parseFloat(priceRaw) || 0);
        if (!name || !price) continue;

        const slug  = raw.slug ?? raw.url ?? item.url ?? "";
        const url   = slug
          ? slug.startsWith("http") ? slug : `https://www.dyson.co.th${slug}`
          : targetUrl;

        results.push({ name, price, url, inStock: true, rating: 0, reviews: 0 });
      }
    }

    // ── DOM fallback ─────────────────────────────────────────────────────────
    if (results.length === 0) {
      console.log("[Dyson] API empty — trying DOM...");

      const domItems = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll(
          "[class*='product-card'], [class*='ProductCard'], " +
          "[class*='product-tile'], [class*='ProductTile'], " +
          "[class*='product-item'], article[class*='product'], " +
          ".product-card, .product-tile"
        ));

        return cards.slice(0, 15).map((card) => {
          const nameEl  = card.querySelector(
            "[class*='product-name'], [class*='ProductName'], " +
            "[class*='title'], h2, h3, h4, p[class*='name']"
          );
          const priceEl = card.querySelector(
            "[class*='price'], [class*='Price'], " +
            "[class*='amount'], [class*='Amount']"
          );
          const linkEl  = card.querySelector("a[href]") as HTMLAnchorElement | null;

          const name     = nameEl?.textContent?.trim().replace(/\s+/g, " ") ?? "";
          // Dyson prices like "฿15,900" or "15,900 บาท"
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
            url:     item.url || targetUrl,
            inStock: true,
            rating:  0,
            reviews: 0,
          });
      }

      if (results.length === 0) {
        const title = await page.title().catch(() => "?");
        console.log(`[Dyson] No results — page: "${title.slice(0, 60)}"`);
      }
    }

  } catch (err) {
    console.error(`[Dyson] Error "${keyword}":`, (err as Error).message);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    console.log("[Dyson] Browser closed");
  }

  console.log(`[Dyson] "${keyword}" → ${results.length} results`);
  return results;
}
