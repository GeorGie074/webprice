/**
 * Banana IT (bnn.in.th) scraper — category-based DOM scraping.
 *
 * BNN does not have a general keyword search URL.
 * Instead, products are listed under brand/model category pages:
 *   /p/apple/iphone/iphone-16
 *   /p/apple/apple-ipad
 *   /p/apple/apple-mac
 *   /p/audio/sony
 *   /p/notebook/asus
 *
 * Strategy:
 *  1. Map the search keyword to the best BNN category URL.
 *  2. Navigate to that category page (SSR — no AJAX interception needed).
 *  3. Scrape [class*="product-item"] elements for name, price, URL.
 *  4. Deduplicate (each card appears twice: with & without "สินค้าหมด" label).
 *  5. Return ScrapedItem[] for the shared bestMatch() filter.
 */

import { createContext, closeBrowser } from "./browser.js";
import type { ScrapedItem } from "./shopee.js";

// ─── Keyword → BNN category URL ───────────────────────────────────────────────
// Rules are matched in order; first match wins.
// Returns null if the product is unlikely to be on BNN (fashion, home, etc.)
function bnnCategoryUrl(keyword: string): string | null {
  const kw = keyword.toLowerCase();

  // Apple — specific model pages first, then broader categories
  if (/iphone\s*16/.test(kw))   return "/p/apple/iphone/iphone-16";
  if (/iphone\s*15/.test(kw))   return "/p/apple/iphone/iphone-15";
  if (/iphone\s*14/.test(kw))   return "/p/apple/iphone/iphone-14";
  if (/iphone/.test(kw))        return "/p/apple/apple-iphone";
  if (/ipad\s*air/.test(kw))    return "/p/apple/apple-ipad";
  if (/ipad\s*pro/.test(kw))    return "/p/apple/apple-ipad";
  if (/ipad\s*mini/.test(kw))   return "/p/apple/apple-ipad";
  if (/ipad/.test(kw))          return "/p/apple/apple-ipad";
  if (/macbook\s*air/.test(kw)) return "/p/apple/apple-mac";
  if (/macbook\s*pro/.test(kw)) return "/p/apple/apple-mac";
  if (/macbook/.test(kw))       return "/p/apple/apple-mac";
  if (/apple\s*watch/.test(kw)) return "/p/apple/apple-watch";
  if (/airpods/.test(kw))       return "/p/apple/airpods";

  // Sony — /p/audio-and-headphone/sony has 96 products (vs /p/audio/sony = 24)
  if (/sony.*wh|sony.*wf|sony.*xm/.test(kw)) return "/p/audio-and-headphone/sony";
  if (/sony/.test(kw))          return "/p/audio-and-headphone/sony";

  // ASUS
  if (/asus.*rog|rog.*zephyrus|zephyrus/.test(kw)) return "/p/notebook/asus";
  if (/asus.*vivobook|asus.*zenbook|asus.*tuf/.test(kw)) return "/p/notebook/asus";
  if (/asus/.test(kw))          return "/p/notebook/asus";

  // Samsung — smartphones are in a different BNN section
  // (the main Samsung category shows projectors; skip for now)

  // Products NOT on BNN (home appliances, fashion)
  // dyson, nike, adidas, uniqlo, etc.
  return null;
}

// ─── Main scraper ──────────────────────────────────────────────────────────────
export async function scrapeBNN(keyword: string): Promise<ScrapedItem[]> {
  const categoryPath = bnnCategoryUrl(keyword);
  if (!categoryPath) {
    console.log(`[BNN] No category for "${keyword}" — skipping`);
    return [];
  }

  const context = await createContext();
  const page    = await context.newPage();
  const results: ScrapedItem[] = [];

  try {
    // ── 1. Homepage warm-up (establishes cookies / JWT) ──────────────────────
    console.log("[BNN] Warming up homepage...");
    await page.goto("https://www.bnn.in.th/th", {
      waitUntil: "domcontentloaded",
      timeout: 25_000,
    });
    await page.waitForTimeout(1_500);

    // ── 2. Navigate to category listing page ─────────────────────────────────
    const targetUrl = `https://www.bnn.in.th${categoryPath}`;
    console.log(`[BNN] Searching "${keyword}" via ${categoryPath}`);
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 25_000,
    });

    // Scroll to trigger lazy-load of product images / late-rendered cards
    for (let y = 0; y <= 1_500; y += 300) {
      await page.evaluate((sy) => window.scrollTo(0, sy), y);
      await page.waitForTimeout(350);
    }
    await page.waitForTimeout(1_000);

    // ── 3. Scrape product cards from DOM ─────────────────────────────────────
    const raw = await page.evaluate(() => {
      const cards = Array.from(
        document.querySelectorAll('[class*="product-item"]')
      ).filter((el) => (el as HTMLElement).innerText.includes("฿"));

      return cards.map((el) => {
        const elem = el as HTMLElement;
        const text = elem.innerText;

        // Price — take the FIRST price (minimum of a range like "฿26,500 – ฿38,800")
        const priceMatch = text.match(/฿\s*([\d,]+)/);
        const price = priceMatch
          ? parseFloat(priceMatch[1].replace(/,/g, ""))
          : 0;

        // Name — filter out brand tags, price/discount lines, breadcrumbs
        const lines = text
          .split("\n")
          .map((l) => l.trim())
          .filter(
            (l) =>
              l.length > 8 &&
              !l.match(/^[A-Z\s&]+$/) &&          // ALL-CAPS brand tags
              !l.includes("฿") &&                  // price lines
              !l.includes("ประหยัดไป") &&           // discount labels
              !l.includes("หน้าหลัก") &&            // breadcrumbs
              !l.includes("สินค้าหมด") &&           // out-of-stock label
              !l.match(/^\d+$/)                     // bare numbers
          );
        const name = lines[0] || "";

        // Out-of-stock flag
        const inStock = !text.includes("สินค้าหมด");

        // URL — walk up the DOM tree to find the nearest <a> ancestor
        let link = "";
        let node: Element = el;
        for (let i = 0; i < 8; i++) {
          if ((node as HTMLAnchorElement).href) {
            link = (node as HTMLAnchorElement).href;
            break;
          }
          if (node.parentElement) node = node.parentElement;
          else break;
        }
        // Fallback: first child <a>
        if (!link) {
          link = (el.querySelector("a") as HTMLAnchorElement | null)?.href || "";
        }
        // Clean tracking params — keep just the path
        if (link) {
          try {
            const u = new URL(link);
            u.searchParams.delete("ref");
            u.searchParams.delete("verify");
            link = u.toString();
          } catch {}
        }

        return { name, price, url: link, inStock };
      });
    }).catch(() => [] as { name: string; price: number; url: string; inStock: boolean }[]);

    // ── 4. De-duplicate (each card renders once "out-of-stock" + once normal) ─
    const seen = new Set<string>();
    for (const item of raw) {
      if (!item.price || !item.name) continue;
      // Use URL as the dedup key; fall back to name+price
      const key = item.url || `${item.name}::${item.price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        name:     item.name,
        price:    item.price,
        url:      item.url || targetUrl,
        inStock:  item.inStock,
        rating:   0,
        reviews:  0,
      });
    }

    if (results.length === 0) {
      const title = await page.title().catch(() => "?");
      console.log(`[BNN] No products scraped — page title: "${title.slice(0, 60)}"`);
    }
  } catch (err) {
    console.error("[BNN] Error:", (err as Error).message);
  } finally {
    await context.close().catch(() => {});
    await closeBrowser();
  }

  console.log(`[BNN] "${keyword}" → ${results.length} results from ${categoryPath}`);
  return results;
}
