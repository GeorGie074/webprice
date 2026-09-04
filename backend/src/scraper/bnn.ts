/**
 * Banana IT (bnn.in.th) scraper — category-based DOM scraping.
 *
 * Two code paths:
 *  A) ScraperAPI API mode (when SCRAPERAPI_KEY is set — used on Railway):
 *     GET http://api.scraperapi.com/?api_key=KEY&url=ENCODED_BNN_URL
 *     → Returns server-rendered HTML (BNN is SSR) → parse with Cheerio.
 *     Port 80 — always reachable from Railway.
 *
 *  B) Playwright mode (local dev, no SCRAPERAPI_KEY):
 *     Launch headed Chrome, navigate, evaluate DOM.
 *
 * BNN uses category-based URLs (no keyword search):
 *   /p/apple/iphone/iphone-16  /p/notebook/asus  etc.
 */

import { load } from "cheerio";
import { createContext, closeBrowser } from "./browser.js";
import type { ScrapedItem } from "./shopee.js";

// ─── Keyword → BNN category URL ───────────────────────────────────────────────
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

  return null;
}

// ─── Path A: ScraperAPI fetch + Cheerio ───────────────────────────────────────
async function scrapeBNNViaScraperAPI(
  keyword: string,
  categoryPath: string,
  apiKey: string
): Promise<ScrapedItem[]> {
  const targetUrl = `https://www.bnn.in.th${categoryPath}`;
  const scraperUrl =
    `http://api.scraperapi.com/?api_key=${apiKey}` +
    `&url=${encodeURIComponent(targetUrl)}&country_code=th`;

  console.log(`[BNN] Fetching "${keyword}" via ScraperAPI (${categoryPath})...`);
  const res = await fetch(scraperUrl, {
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`ScraperAPI HTTP ${res.status}`);
  const html = await res.text();

  const $ = load(html);
  const results: ScrapedItem[] = [];
  const seen = new Set<string>();

  // BNN renders product cards with class containing "product-item"
  $('[class*="product-item"]').each((_, el) => {
    const text = $(el).text();
    if (!text.includes("฿")) return; // skip non-product elements

    // ── Price ──────────────────────────────────────────────────────────────────
    const priceMatch = text.match(/฿\s*([\d,]+)/);
    const price = priceMatch
      ? parseFloat(priceMatch[1].replace(/,/g, ""))
      : 0;
    if (!price) return;

    // ── Name ───────────────────────────────────────────────────────────────────
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(
        (l) =>
          l.length > 8 &&
          !l.match(/^[A-Z\s&]+$/) &&       // ALL-CAPS brand tags
          !l.includes("฿") &&               // price lines
          !l.includes("ประหยัดไป") &&       // discount labels
          !l.includes("หน้าหลัก") &&        // breadcrumbs
          !l.includes("สินค้าหมด") &&       // out-of-stock
          !l.match(/^\d+$/)                 // bare numbers
      );
    const name = lines[0] || "";
    if (!name) return;

    // ── URL ────────────────────────────────────────────────────────────────────
    // Walk up the DOM to find nearest <a>
    let link = "";
    let node = el as any;
    for (let i = 0; i < 8; i++) {
      if (node.attribs?.href) {
        link = node.attribs.href;
        break;
      }
      node = (node as any).parent;
      if (!node) break;
    }
    if (!link) {
      link = $(el).find("a").first().attr("href") || "";
    }
    if (link && !link.startsWith("http")) {
      link = `https://www.bnn.in.th${link.startsWith("/") ? "" : "/"}${link}`;
    }
    // Remove tracking params
    if (link) {
      try {
        const u = new URL(link);
        u.searchParams.delete("ref");
        u.searchParams.delete("verify");
        link = u.toString();
      } catch {}
    }

    // ── In-stock ───────────────────────────────────────────────────────────────
    const inStock = !text.includes("สินค้าหมด");

    // ── De-duplicate ───────────────────────────────────────────────────────────
    const key = link || `${name}::${price}`;
    if (seen.has(key)) return;
    seen.add(key);

    results.push({
      name,
      price,
      url: link || targetUrl,
      inStock,
      rating: 0,
      reviews: 0,
    });
  });

  return results;
}

// ─── Path B: Playwright (local dev) ───────────────────────────────────────────
async function scrapeBNNViaPlaywright(
  keyword: string,
  categoryPath: string
): Promise<ScrapedItem[]> {
  const context = await createContext(false);
  const page = await context.newPage();
  const results: ScrapedItem[] = [];
  const targetUrl = `https://www.bnn.in.th${categoryPath}`;

  try {
    // Homepage warm-up (establishes cookies / JWT)
    console.log("[BNN] Warming up homepage...");
    await page.goto("https://www.bnn.in.th/th", {
      waitUntil: "domcontentloaded",
      timeout: 25_000,
    });
    await page.waitForTimeout(1_500);

    console.log(`[BNN] Navigating to ${categoryPath}...`);
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 25_000,
    });

    for (let y = 0; y <= 1_500; y += 300) {
      await page.evaluate((sy) => window.scrollTo(0, sy), y);
      await page.waitForTimeout(350);
    }
    await page.waitForTimeout(1_000);

    const raw = await page
      .evaluate(() => {
        const cards = Array.from(
          document.querySelectorAll('[class*="product-item"]')
        ).filter((el) => (el as HTMLElement).innerText.includes("฿"));

        return cards.map((el) => {
          const elem = el as HTMLElement;
          const text = elem.innerText;
          const priceMatch = text.match(/฿\s*([\d,]+)/);
          const price = priceMatch
            ? parseFloat(priceMatch[1].replace(/,/g, ""))
            : 0;
          const lines = text
            .split("\n")
            .map((l) => l.trim())
            .filter(
              (l) =>
                l.length > 8 &&
                !l.match(/^[A-Z\s&]+$/) &&
                !l.includes("฿") &&
                !l.includes("ประหยัดไป") &&
                !l.includes("หน้าหลัก") &&
                !l.includes("สินค้าหมด") &&
                !l.match(/^\d+$/)
            );
          const name = lines[0] || "";
          const inStock = !text.includes("สินค้าหมด");
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
          if (!link) {
            link =
              (el.querySelector("a") as HTMLAnchorElement | null)?.href || "";
          }
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
      })
      .catch(() => [] as { name: string; price: number; url: string; inStock: boolean }[]);

    const seen = new Set<string>();
    for (const item of raw) {
      if (!item.price || !item.name) continue;
      const key = item.url || `${item.name}::${item.price}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        name: item.name,
        price: item.price,
        url: item.url || targetUrl,
        inStock: item.inStock,
        rating: 0,
        reviews: 0,
      });
    }

    if (results.length === 0) {
      const title = await page.title().catch(() => "?");
      console.log(`[BNN] No products — page title: "${title.slice(0, 60)}"`);
    }
  } catch (err) {
    console.error("[BNN] Playwright error:", (err as Error).message);
  } finally {
    await context.close().catch(() => {});
    await closeBrowser();
  }

  return results;
}

// ─── Entry point ───────────────────────────────────────────────────────────────
export async function scrapeBNN(keyword: string): Promise<ScrapedItem[]> {
  const categoryPath = bnnCategoryUrl(keyword);
  if (!categoryPath) {
    console.log(`[BNN] No category for "${keyword}" — skipping`);
    return [];
  }

  const apiKey = process.env.SCRAPERAPI_KEY;

  if (apiKey) {
    try {
      const results = await scrapeBNNViaScraperAPI(keyword, categoryPath, apiKey);
      console.log(
        `[BNN] "${keyword}" → ${results.length} results (ScraperAPI, ${categoryPath})`
      );
      return results;
    } catch (err) {
      console.error(
        `[BNN] ScraperAPI failed: ${(err as Error).message} — falling back to Playwright`
      );
    }
  }

  const results = await scrapeBNNViaPlaywright(keyword, categoryPath);
  console.log(
    `[BNN] "${keyword}" → ${results.length} results (Playwright, ${categoryPath})`
  );
  return results;
}
