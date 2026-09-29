import { load } from "cheerio";
import { createContext } from "./browser.js";
import type { ScrapedItem } from "./shopee.js";

/**
 * Scrape JIB Computer (jib.co.th) — major Thai IT retailer.
 *
 * Two code paths:
 *  A) ScraperAPI mode (SCRAPERAPI_KEY set — used on Railway):
 *     GET http://api.scraperapi.com/?api_key=KEY&url=...&render=true
 *     → Returns JS-rendered HTML → parse with Cheerio.
 *
 *  B) Playwright mode (local dev, no SCRAPERAPI_KEY).
 *
 * Confirmed HTML structure (inspected Sept 2026):
 *   Card:   .col-md-3.col-sm-4.col-xs-6.divboxpro
 *   Name:   span.promo_name  (inside .boxname — avoids nested-<a> parsing issues)
 *   URL:    a[href*="/readProduct/"]  (two anchors per card with same URL; grab first)
 *   Price:  p.price_total  (inside .row.boxprice → .col-md-6.text-right)
 *   Image:  img.imgpspecial
 *   Stock:  absence of "สินค้าหมด" in card text
 *
 * Return value: { items, confirmed }
 *   confirmed = true  → a valid JIB search-results page was loaded and parsed;
 *                        0 items means JIB genuinely doesn't carry the product.
 *   confirmed = false → scraper was blocked / page load failed / uncertain result;
 *                        caller should preserve existing seeded price.
 */

export interface JIBScrapeResult {
  items: ScrapedItem[];
  confirmed: boolean;
}

// ─── Page validity check ──────────────────────────────────────────────────────
//
// Returns true when the HTML is from a genuine JIB search-results page.
// Cloudflare challenge pages, gateway errors, and empty stubs fail these checks.
//
// Markers used (all JIB-specific, absent from challenge/error pages):
//   • html.length > 10 KB      — real JIB pages are always substantial
//   • "jib.co.th"              — canonical domain appears in header/footer links
//   • "product_search"         — search endpoint path embedded in pagination/forms
//   • "divboxpro"              — product card CSS class (present even with items)
//   • "ไม่พบสินค้า"            — "product not found" message on genuine 0-results page
//
function isValidJibPage(html: string): boolean {
  if (html.length < 10_000) return false;
  return (
    html.includes("jib.co.th")      ||
    html.includes("product_search") ||
    html.includes("divboxpro")      ||
    html.includes("ไม่พบสินค้า")
  );
}

// ─── Shared parse helper ──────────────────────────────────────────────────────

function parsePrice(text: string): number {
  // "54,900.-" or "54,900" or "54900"
  const nums = (text.match(/[\d,]+/g) ?? [])
    .map((n) => parseFloat(n.replace(/,/g, "")))
    .filter((n) => n >= 100 && n <= 10_000_000);
  return nums.length > 0 ? Math.round(Math.min(...nums)) : 0;
}

function resolveUrl(href: string, fallback: string): string {
  if (!href) return fallback;
  if (href.startsWith("http")) return href;
  return `https://www.jib.co.th${href.startsWith("/") ? "" : "/"}${href}`;
}

// ─── Path A: ScraperAPI fetch + Cheerio ───────────────────────────────────────

async function scrapeJIBViaScraperAPI(
  keyword: string,
  apiKey: string
): Promise<JIBScrapeResult> {
  const jibUrl = `https://www.jib.co.th/web/product/product_search/0?str_search=${encodeURIComponent(keyword)}&cate_id[]=`;
  // render=true: tells ScraperAPI to execute JS before returning HTML
  const scraperUrl =
    `http://api.scraperapi.com/?api_key=${apiKey}` +
    `&url=${encodeURIComponent(jibUrl)}&country_code=th&render=true`;

  console.log(`[JIB] Fetching via ScraperAPI (render=true)...`);
  const res = await fetch(scraperUrl, {
    signal: AbortSignal.timeout(60_000), // render mode needs more time
  });
  if (!res.ok) throw new Error(`ScraperAPI HTTP ${res.status}`);
  const html = await res.text();

  const confirmed = isValidJibPage(html);
  const items = parseJIBHtml(html, jibUrl);
  if (!confirmed) {
    console.warn(`[JIB] ScraperAPI: page validity check failed (blocked/challenge?), html.length=${html.length}`);
  }
  return { items, confirmed };
}

function parseJIBHtml(html: string, fallbackUrl: string): ScrapedItem[] {
  const $ = load(html);
  const results: ScrapedItem[] = [];

  $(".col-md-3.col-sm-4.col-xs-6")
    .slice(0, 15)
    .each((_, card) => {
      // ── Name ─────────────────────────────────────────────────────────────────
      // Use .promo_name span directly — avoids nested-<a> parsing ambiguity.
      const name = $(card).find(".promo_name").first().text().trim().replace(/\s+/g, " ");

      // ── URL ──────────────────────────────────────────────────────────────────
      // Two <a href="...readProduct/..."> per card; grab the first one.
      const rawHref = $(card).find('a[href*="/readProduct/"]').first().attr("href") ?? "";
      const url = resolveUrl(rawHref, fallbackUrl);

      // ── Image ─────────────────────────────────────────────────────────────────
      const imgEl = $(card).find("img.imgpspecial, img.img-responsive").first();
      const imgSrc = imgEl.attr("src") || imgEl.attr("data-src") || "";
      const image = imgSrc && imgSrc.startsWith("http") ? imgSrc : undefined;

      // ── Price ─────────────────────────────────────────────────────────────────
      // p.price_total is the definitive price element inside .row.boxprice.
      const priceText = $(card).find(".price_total").first().text();
      const price = parsePrice(priceText);

      // ── In-stock ──────────────────────────────────────────────────────────────
      const inStock = !$(card).text().includes("สินค้าหมด");

      if (name && price > 0) {
        results.push({ name, price, url, inStock, rating: 0, reviews: 0, image });
      }
    });

  return results;
}

// ─── Path B: Playwright (local dev) ───────────────────────────────────────────

async function scrapeJIBViaPlaywright(keyword: string): Promise<JIBScrapeResult> {
  const context = await createContext(false);
  const page = await context.newPage();
  const searchUrl = `https://www.jib.co.th/web/product/product_search/0?str_search=${encodeURIComponent(keyword)}&cate_id[]=`;

  try {
    console.log(`[JIB] Searching "${keyword}" via Playwright...`);
    await page
      .goto(searchUrl, { waitUntil: "networkidle", timeout: 35_000 })
      .catch(() =>
        page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 35_000 })
      );
    await page.waitForTimeout(1_500);

    // ── Confirm page validity ──────────────────────────────────────────────────
    // Check that Playwright actually landed on a real JIB page (not a CAPTCHA/block).
    // We use the final URL (must still be jib.co.th) and the page title.
    const finalUrl   = page.url();
    const pageTitle  = await page.title().catch(() => "");
    const confirmed  =
      finalUrl.includes("jib.co.th") &&
      (pageTitle.toLowerCase().includes("jib") || finalUrl.includes("product_search"));

    if (!confirmed) {
      console.warn(`[JIB] Playwright: page validity check failed. URL="${finalUrl.slice(0, 80)}" title="${pageTitle.slice(0, 60)}"`);
    }

    const items = await page
      .evaluate(() => {
        return Array.from(document.querySelectorAll(".col-md-3.col-sm-4.col-xs-6"))
          .slice(0, 15)
          .map((card) => {
            // Name: use promo_name span directly
            const name =
              (card.querySelector(".promo_name") as HTMLElement)?.innerText
                ?.trim()
                .replace(/\s+/g, " ") ?? "";

            // URL: first readProduct anchor
            const anchor = card.querySelector('a[href*="/readProduct/"]') as HTMLAnchorElement | null;
            const url = anchor?.href ?? "";

            // Image
            const imgEl = (card.querySelector("img.imgpspecial") ??
              card.querySelector("img.img-responsive")) as HTMLImageElement | null;
            const image = imgEl?.src || imgEl?.getAttribute("data-src") || "";

            // Price: p.price_total
            const priceText = (card.querySelector(".price_total") as HTMLElement)?.innerText ?? "";
            const nums = (priceText.match(/[\d,]+/g) ?? [])
              .map((n: string) => parseFloat(n.replace(/,/g, "")))
              .filter((n: number) => n >= 100 && n <= 10_000_000);
            const price = nums.length > 0 ? Math.round(Math.min(...nums)) : 0;

            const inStock = !(card.textContent ?? "").includes("สินค้าหมด");
            return { name, price, url, inStock, image };
          });
      })
      .catch(() => [] as { name: string; price: number; url: string; inStock: boolean; image: string }[]);

    const results: ScrapedItem[] = [];
    for (const item of items) {
      if (item.name && item.price > 0) {
        results.push({
          name: item.name,
          price: item.price,
          url: item.url || searchUrl,
          inStock: item.inStock,
          rating: 0,
          reviews: 0,
          image: item.image?.startsWith("http") ? item.image : undefined,
        });
      }
    }

    if (results.length === 0) {
      console.log(`[JIB] No results — confirmed=${confirmed} title="${pageTitle.slice(0, 60)}"`);
    }
    return { items: results, confirmed };

  } catch (err) {
    console.error(`[JIB] Playwright error "${keyword}":`, (err as Error).message);
    return { items: [], confirmed: false };
  } finally {
    await context.close().catch(() => {});
  }
}

// ─── Entry point ───────────────────────────────────────────────────────────────

export async function scrapeJIB(keyword: string): Promise<JIBScrapeResult> {
  const apiKey = process.env.SCRAPERAPI_KEY;

  if (apiKey) {
    try {
      const result = await scrapeJIBViaScraperAPI(keyword, apiKey);
      console.log(
        `[JIB] "${keyword}" → ${result.items.length} results (ScraperAPI, confirmed=${result.confirmed})`
      );
      return result;
    } catch (err) {
      console.error(
        `[JIB] ScraperAPI failed: ${(err as Error).message} — falling back to Playwright`
      );
    }
  }

  const result = await scrapeJIBViaPlaywright(keyword);
  console.log(
    `[JIB] "${keyword}" → ${result.items.length} results (Playwright, confirmed=${result.confirmed})`
  );
  return result;
}
