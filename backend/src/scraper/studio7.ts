import { chromium } from "playwright";
import type { ScrapedItem } from "./shopee.js";

/**
 * Scrape Studio 7 Thailand (Apple Authorized Reseller).
 *
 * Strategy:
 *  1. Navigate to the search URL: /th/search?q={keyword}
 *     NOTE: Studio 7's Nuxt SSR returns a visual 404 for this route, BUT the
 *     client-side Nuxt app still runs and fires API requests — so the response
 *     interceptor captures data correctly. Do NOT change the URL.
 *  2. Intercept `api.studio7thailand.com/store/product-groups?q=...` response.
 *     → Requires `x-signature` auth header computed client-side — captured via browser.
 *  3. Parse items: `primary_product_price` is in SATANG (÷100 = Baht).
 *  4. Product URL: `https://www.studio7thailand.com/th/product/{product_group_slug}`
 *     Fallback (no slug): Studio 7 category page (not the search URL — that 404s).
 *
 * Products carried: iPhones, MacBooks, iPads, Apple Watch (Apple ecosystem only).
 */

/**
 * Maps a search keyword to the correct Studio 7 collection page URL.
 *
 * Rules:
 *  - Order matters: check more-specific terms ("ipad pro") before broader ones ("ipad").
 *  - Always use verified /th/collection/ or /en/collection/ paths — bare /collection/
 *    without a language prefix returns 404 on the current Studio 7 site.
 *  - These are stable collection pages, not individual product listings, so they
 *    never go 404 when Studio 7 updates their catalog.
 */
function categoryUrl(keyword: string): string {
  const kl = keyword.toLowerCase();

  // iPhone
  if (kl.includes("iphone"))
    return "https://www.studio7thailand.com/th/collection/iphone-17-series";

  // MacBook — check "pro" before generic "macbook"
  if (kl.includes("macbook pro") || kl.includes("macbook pro"))
    return "https://www.studio7thailand.com/en/collection/macbook-pro-series";
  if (kl.includes("macbook") || kl.includes("mac"))
    return "https://www.studio7thailand.com/en/collection/macbook-air-series";

  // iPad — check specific variants before generic "ipad"
  if (kl.includes("ipad mini"))
    return "https://www.studio7thailand.com/en/collection/apple-ipad-mini-series";
  if (kl.includes("ipad pro"))
    return "https://www.studio7thailand.com/en/collection/apple-ipad-pro-series";
  if (kl.includes("ipad air") || kl.includes("ipad"))
    return "https://www.studio7thailand.com/en/collection/apple-ipad-air-series";

  // Accessories / wearables
  if (kl.includes("watch"))
    return "https://www.studio7thailand.com/en/collection/apple-watch-series-10";
  if (kl.includes("airpod"))
    return "https://www.studio7thailand.com/en/collection/airpods-4-anc";

  return "https://www.studio7thailand.com/en";  // generic fallback
}
export async function scrapeStudio7(keyword: string): Promise<ScrapedItem[]> {
  const browser = await chromium.launch({
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1366,768",
      "--window-position=-8000,-8000",
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
  });

  const page    = await context.newPage();
  const results: ScrapedItem[] = [];

  try {
    const searchUrl = `https://www.studio7thailand.com/th/search?q=${encodeURIComponent(keyword)}`;

    // ── Intercept product-groups API ─────────────────────────────────────────
    let capturedItems: any[] = [];

    page.on("response", async (resp) => {
      const url = resp.url();
      if (
        resp.status() === 200 &&
        url.includes("api.studio7thailand.com") &&
        url.includes("product-groups")
      ) {
        try {
          const data     = await resp.json();
          const items: any[] = data?.data?.items ?? [];
          if (items.length > 0 && capturedItems.length === 0) {
            capturedItems = items;
            console.log(`[Studio7] API captured ${items.length} items`);
          }
        } catch { /* body freed */ }
      }
    });

    // ── Navigate to search ───────────────────────────────────────────────────
    console.log(`[Studio7] Searching "${keyword}"...`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Wait for the Nuxt SPA + API response
    for (let y = 0; y <= 1200; y += 300) {
      try { await page.evaluate((s) => window.scrollTo(0, s), y); } catch { break; }
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(2_000);

    // ── Parse API results ────────────────────────────────────────────────────
    if (capturedItems.length > 0) {
      for (const item of capturedItems.slice(0, 12)) {
        const name = (item.name ?? "").trim();
        // Price is in satang (1/100 Baht) — divide by 100
        const price = Math.round((item.primary_product_price ?? item.min_price ?? 0) / 100);
        if (!name || !price) continue;

        // ── Price guard: skip obvious accessories ────────────────────────
        // Studio 7's cheapest real product (Apple Watch SE) starts at ~฿4,500.
        // Items under ฿2,000 are almost certainly accessories (cases, films,
        // screen protectors, cables) that share the product's name in their title
        // but are NOT the device itself.
        if (price < 2_000) {
          console.log(`[Studio7] Skipping "${name.slice(0, 60)}" (฿${price}) — price < ฿2,000, likely accessory`);
          continue;
        }

        // ── URL: always use the verified collection page ─────────────────
        // Product-slug URLs (/th/product/{slug}) change when Studio 7 updates
        // their catalog and go 404 silently. Collection pages are stable and
        // always show relevant products for that keyword.
        const url = categoryUrl(keyword);

        results.push({
          name,
          price,
          url,
          inStock: !item.is_pre_order && item.is_active !== false,
          rating:  0,
          reviews: 0,
        });
      }
    }

    if (results.length === 0) {
      const title = await page.title().catch(() => "?");
      console.log(`[Studio7] No results — page: "${title.slice(0, 60)}"`);
    }

  } catch (err) {
    console.error(`[Studio7] Error "${keyword}":`, (err as Error).message);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    console.log("[Studio7] Browser closed");
  }

  console.log(`[Studio7] "${keyword}" → ${results.length} results`);
  return results;
}
