/**
 * Shopee Thailand scraper — Playwright API response interception.
 *
 * ─── Architecture ──────────────────────────────────────────────────────────
 * Shopee renders its product grid via /api/v4/search/search_items (XHR).
 * We intercept that response via page.on("response") and read the JSON body
 * immediately — this avoids DOM scraping entirely and is unaffected by
 * class-name churn or lazy-rendering.
 *
 *   Browser loads page
 *     └─ Shopee JS runs → generates af-ac-enc-dat, SPC_CDS cookies automatically
 *     └─ fires XHR to /api/v4/search/search_items
 *          └─ page.on("response") fires → we read body immediately
 *
 * WHY page.on() not waitForResponse():
 *   Shopee's SPA can navigate mid-scroll, freeing the response body before the
 *   waitForResponse() caller gets to call .json(). page.on() reads it in-place
 *   the moment it arrives.
 *
 * ─── Price encoding ────────────────────────────────────────────────────────
 *   All prices are integer × 100,000.  ฿24,900 → 2,490,000,000 ÷ 100,000
 *
 * ─── Product URL ───────────────────────────────────────────────────────────
 *   https://shopee.co.th/product/{shopid}/{itemid}
 *
 * ─── Re-enable after account ban ───────────────────────────────────────────
 *   1. Create a fresh Shopee account (new email/phone, never automated).
 *   2. Browse Shopee manually once from the same IP.
 *   3. Run: node test-shopee-api.mjs "iPhone 16"  to verify.
 *   4. Remove the early-return DISABLED guard below.
 */

import { existsSync } from "fs";
import { createContext, closeBrowser } from "./browser.js";

const SESSION_FILE = new URL("../../shopee-session.json", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");

export interface ScrapedCoupon {
  description: string;
  discount:    number;  // THB fixed amount (0 if pct-based)
  discountPct: number;  // percent (0 if fixed)
  minSpend:    number;  // 0 = no minimum
  afterPrice:  number;  // price - applicable discount
}

export interface ScrapedItem {
  name:    string;
  price:   number;
  url:     string;
  inStock: boolean;
  rating:  number;
  reviews: number;
  /** Product image URL scraped from the listing (optional — filled in when available) */
  image?:  string;
  coupon?: ScrapedCoupon;
}

export async function scrapeShopee(keyword: string): Promise<ScrapedItem[]> {
  // ── DISABLED — remove these 3 lines once you have a fresh account ──────────
  console.log("[Shopee] ⛔ Disabled (account banned) — returning []");
  return [];
  // ──────────────────────────────────────────────────────────────────────────

  /* eslint-disable no-unreachable */
  if (!existsSync(SESSION_FILE)) {
    console.log("[Shopee] ⚠️  shopee-session.json not found — run setup-shopee-session.mjs first");
    return [];
  }

  // Load saved login session (cookies + localStorage from setup-shopee-session.mjs)
  const browser = await (await import("./browser.js")).getBrowser();
  const context = await browser.newContext({
    storageState: SESSION_FILE,
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
  await context.addInitScript(`Object.defineProperty(navigator,'webdriver',{get:()=>undefined});`);
  const page    = await context.newPage();
  const results: ScrapedItem[] = [];

  try {
    // ── 1. Homepage warm-up (re-establishes session with saved cookies) ──────
    console.log("[Shopee] Visiting homepage...");
    await page.goto("https://shopee.co.th/", {
      waitUntil: "domcontentloaded",
      timeout:   25_000,
    });
    await page.waitForTimeout(2_000);

    // ── 2. Register response listener BEFORE navigating ──────────────────────
    // Read body immediately in the handler — SPA navigation can free the body
    // before an external .json() call would complete.
    const searchUrl = `https://shopee.co.th/search?keyword=${encodeURIComponent(keyword)}&sortBy=relevancy`;

    let capturedItems: any[] | null = null;

    page.on("response", async (resp) => {
      if (
        resp.url().includes("/api/v4/search/search_items") &&
        resp.status() === 200 &&
        capturedItems === null
      ) {
        try {
          const data  = await resp.json();
          const items: any[] = data?.items ?? [];
          if (items.length > 0) {
            capturedItems = items;
            console.log(`[Shopee] API captured ${items.length} items`);
          }
        } catch { /* body freed by navigation — will fall through to DOM */ }
      }
    });

    // ── 3. Navigate to search page ───────────────────────────────────────────
    console.log(`[Shopee] Searching for "${keyword}"...`);
    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout:   30_000,
    });

    // Scroll to trigger lazy-loading; catch SPA navigation errors mid-scroll
    for (let y = 0; y <= 1_500; y += 300) {
      try {
        await page.evaluate((sy) => window.scrollTo(0, sy), y);
      } catch { break; } // navigation destroyed context — fine, API already fired
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(1_500); // let any late-firing API calls land

    // ── 4. Build results from captured API items ─────────────────────────────
    if (capturedItems !== null) {
      for (const item of (capturedItems as any[]).slice(0, 20)) {
        const b = item.item_basic ?? item;

        // Price: integer × 100,000  (e.g. 2_490_000_000 → ฿24,900)
        const rawPrice = b.price ?? b.price_min ?? 0;
        const price    = rawPrice > 0 ? rawPrice / 100_000 : 0;
        if (!price) continue;

        const url =
          b.itemid && b.shopid
            ? `https://shopee.co.th/product/${b.shopid}/${b.itemid}`
            : searchUrl;

        // Sum of per-star rating buckets [1★, 2★, 3★, 4★, 5★]
        const ratingCounts: number[] = b.item_rating?.rating_count ?? [];
        const totalReviews = ratingCounts.reduce((s: number, n: number) => s + (n ?? 0), 0);

        results.push({
          name:    b.name    ?? "",
          price,
          url,
          inStock: (b.stock ?? 1) > 0,
          rating:  b.item_rating?.rating_star ?? 0,
          reviews: totalReviews,
        });
      }
    }

    // ── 5. DOM fallback (API wasn't intercepted) ─────────────────────────────
    if (results.length === 0) {
      console.log("[Shopee] API empty — trying DOM fallback...");
      await page.waitForTimeout(3_000);

      const domItems = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll(
          '[data-sqe="item"], [class*="shopee-search-item-result__item"], [class*="col-xs-2-4"]'
        ));
        return cards.slice(0, 20).map((card) => {
          const el      = card as HTMLElement;
          const nameEl  = el.querySelector('[data-sqe="name"], [class*="ellipsis"]');
          const priceEl = el.querySelector('[class*="price--GRgz"], [class*="price"]');
          const link    = (el.querySelector("a") as HTMLAnchorElement | null)?.href ?? "";
          const price   = parseFloat((priceEl?.textContent ?? "").replace(/[^0-9.]/g, ""));
          return { name: nameEl?.textContent?.trim() ?? "", price, link };
        });
      }).catch(() => [] as { name: string; price: number; link: string }[]);

      for (const item of domItems) {
        if (item.name && item.price > 0) {
          results.push({
            name: item.name, price: item.price,
            url: item.link || searchUrl,
            inStock: true, rating: 0, reviews: 0,
          });
        }
      }

      if (results.length === 0) {
        const title = await page.title().catch(() => "?");
        console.log(`[Shopee] DOM empty — page: "${title.slice(0, 60)}"`);
      }
    }

  } catch (err) {
    console.error(`[Shopee] Error "${keyword}":`, (err as Error).message);
  } finally {
    await context.close().catch(() => {});
    await closeBrowser();
  }

  console.log(`[Shopee] "${keyword}" → ${results.length} results`);
  return results;
  /* eslint-enable no-unreachable */
}
