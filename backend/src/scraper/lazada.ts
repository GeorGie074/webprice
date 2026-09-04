import { load } from "cheerio";
import { createContext, closeBrowser } from "./browser.js";
import type { ScrapedItem } from "./shopee.js";

/**
 * Scrape Lazada Thailand.
 *
 * Two code paths:
 *  A) ScraperAPI API mode with render=true (when SCRAPERAPI_KEY is set — Railway):
 *     GET http://api.scraperapi.com/?api_key=KEY&url=ENCODED_URL&render=true
 *     Returns the fully JS-rendered page HTML.
 *     Parse strategy:
 *       1. Extract listItems JSON from embedded <script> tags (fast path).
 *       2. Fall back to Cheerio DOM parsing of product cards.
 *     Port 80 — always reachable from Railway. render=true costs 5 credits/request.
 *
 *  B) Playwright mode (local dev, no SCRAPERAPI_KEY):
 *     Visit homepage → navigate to search → intercept AJAX response.
 *     Falls back to DOM scraping if AJAX not captured.
 */

// ─── Path A: ScraperAPI render=true + Cheerio ─────────────────────────────────

/** Try to extract product list from Lazada's embedded JSON script tags. */
function extractFromScript(html: string): ScrapedItem[] | null {
  // Lazada embeds search result data in a script tag — look for listItems array
  // Pattern: "listItems":[{...},{...}] inside any <script>
  const scriptMatch = html.match(/"listItems"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
  if (!scriptMatch) return null;

  try {
    const items: any[] = JSON.parse(scriptMatch[1]);
    if (!Array.isArray(items) || items.length === 0) return null;

    const results: ScrapedItem[] = [];
    for (const item of items.slice(0, 12)) {
      const rawPrice = item.price ?? item.priceShow ?? "";
      const price = Math.round(parseFloat(String(rawPrice).replace(/[^0-9.]/g, "")));
      if (!price) continue;

      const imgRaw = item.image ?? item.img ?? item.thumbnail ?? "";
      const image = imgRaw
        ? imgRaw.startsWith("//") ? `https:${imgRaw}` : imgRaw
        : undefined;

      results.push({
        name: item.name ?? "",
        price,
        url: item.itemUrl ? `https:${item.itemUrl}` : "",
        inStock: true,
        rating: parseFloat(item.ratingScore ?? "0"),
        reviews: parseInt(item.review ?? "0"),
        image,
      });
    }
    return results.length > 0 ? results : null;
  } catch {
    return null;
  }
}

/** Parse product cards from Lazada's rendered DOM using Cheerio. */
function extractFromDom(html: string, searchUrl: string): ScrapedItem[] {
  const $ = load(html);
  const results: ScrapedItem[] = [];

  // Lazada DOM selectors — try each in priority order
  const selectors = [
    '[data-tracking="product-card"]',
    ".Bm3ON",
    '[class*="product-card"]',
    "div[data-item-id]",
  ];

  let cards: any[] = [];
  for (const sel of selectors) {
    const found = $(sel).toArray();
    if (found.length > 0) { cards = found; break; }
  }

  for (const card of cards.slice(0, 12)) {
    const el = $(card);
    const text = el.text();
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const priceLine = lines.find((l) => l.startsWith("฿")) ?? "";
    const price = Math.round(parseFloat(priceLine.replace(/[^0-9.]/g, "")));
    if (!price) continue;

    const link = el.find("a").first().attr("href") ?? "";
    const imgEl = el.find("img").first();
    const img = imgEl.attr("src") || imgEl.attr("data-src") || "";

    const name = lines[0] ?? "";
    if (!name) continue;

    results.push({
      name,
      price,
      url: link
        ? link.startsWith("http") ? link : `https:${link}`
        : searchUrl,
      inStock: true,
      rating: 0,
      reviews: 0,
      image: img.startsWith("http") ? img : undefined,
    });
  }
  return results;
}

async function scrapeLazadaViaScraperAPI(
  keyword: string,
  apiKey: string
): Promise<ScrapedItem[]> {
  const lazadaUrl = `https://www.lazada.co.th/catalog/?q=${encodeURIComponent(keyword)}&sort=popularity`;
  const scraperUrl =
    `http://api.scraperapi.com/?api_key=${apiKey}` +
    `&url=${encodeURIComponent(lazadaUrl)}&render=true&country_code=th`;

  console.log(`[Lazada] Fetching via ScraperAPI render=true...`);
  const res = await fetch(scraperUrl, {
    signal: AbortSignal.timeout(65_000), // render=true can take up to 60s
  });
  if (!res.ok) throw new Error(`ScraperAPI HTTP ${res.status}`);
  const html = await res.text();

  // 1. Try embedded JSON (fastest, most accurate)
  const fromScript = extractFromScript(html);
  if (fromScript && fromScript.length > 0) {
    console.log(`[Lazada] Extracted ${fromScript.length} items from embedded JSON`);
    return fromScript;
  }

  // 2. Fall back to DOM parsing
  const fromDom = extractFromDom(html, lazadaUrl);
  if (fromDom.length > 0) {
    console.log(`[Lazada] Extracted ${fromDom.length} items from DOM`);
  } else {
    console.log("[Lazada] ScraperAPI returned no parseable products");
  }
  return fromDom;
}

// ─── Path B: Playwright (local dev) ───────────────────────────────────────────
async function scrapeLazadaViaPlaywright(keyword: string): Promise<ScrapedItem[]> {
  const context = await createContext(false);
  const page = await context.newPage();
  const results: ScrapedItem[] = [];
  const searchUrl = `https://www.lazada.co.th/catalog/?q=${encodeURIComponent(keyword)}&sort=popularity`;

  try {
    // ── 1. Homepage — establish trusted session ────────────────────────────────
    console.log("[Lazada] Visiting homepage for cookies...");
    await page.goto("https://www.lazada.co.th/", {
      waitUntil: "domcontentloaded",
      timeout: 25_000,
    });
    await page.waitForTimeout(1_500);

    // ── 2. Set up AJAX response listener BEFORE navigating to search ──────────
    const apiWaiter = page
      .waitForResponse(
        (resp) =>
          resp.url().includes("lazada.co.th") &&
          resp.url().includes("ajax=true") &&
          (resp.url().includes("/catalog") || resp.url().includes("/tag/")) &&
          resp.status() === 200,
        { timeout: 20_000 }
      )
      .catch(() => null);

    // ── 3. Navigate to search ─────────────────────────────────────────────────
    console.log(`[Lazada] Searching for "${keyword}"...`);
    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    for (let y = 0; y <= 1500; y += 300) {
      await page.evaluate((sy) => window.scrollTo(0, sy), y);
      await page.waitForTimeout(400);
    }

    // ── 4. Process AJAX response ──────────────────────────────────────────────
    const apiResp = await apiWaiter;
    if (apiResp) {
      try {
        const data = await apiResp.json();
        const items: any[] = data?.mods?.listItems ?? data?.rgn?.listItems ?? [];
        if (items.length > 0) {
          console.log(`[Lazada] API captured ${items.length} items`);
          for (const item of items.slice(0, 12)) {
            const rawPrice = item.price ?? item.priceShow ?? "";
            const price = Math.round(
              parseFloat(String(rawPrice).replace(/[^0-9.]/g, ""))
            );
            if (!price) continue;
            const imgRaw = item.image ?? item.img ?? item.thumbnail ?? "";
            const image = imgRaw
              ? imgRaw.startsWith("//") ? `https:${imgRaw}` : imgRaw
              : undefined;
            results.push({
              name: item.name ?? "",
              price,
              url: item.itemUrl ? `https:${item.itemUrl}` : searchUrl,
              inStock: true,
              rating: parseFloat(item.ratingScore ?? "0"),
              reviews: parseInt(item.review ?? "0"),
              image,
            });
          }
        }
      } catch { /* JSON parse failed */ }
    }

    // ── 5. DOM fallback ───────────────────────────────────────────────────────
    if (results.length === 0) {
      console.log("[Lazada] API empty — extracting from DOM...");
      await page.waitForTimeout(2_000);

      const domItems = await page
        .evaluate(() => {
          const selectors = [
            '[data-tracking="product-card"]',
            ".Bm3ON",
            '[class*="product-card"]',
            "div[data-item-id]",
          ];
          let cards: Element[] = [];
          for (const sel of selectors) {
            const found = Array.from(document.querySelectorAll(sel));
            if (found.length > 0) { cards = found; break; }
          }
          return cards.slice(0, 12).map((card) => {
            const el = card as HTMLElement;
            const lines = el.innerText?.split("\n").map((l) => l.trim()).filter(Boolean) ?? [];
            const link = (el.querySelector("a") as HTMLAnchorElement)?.href ?? "";
            const priceLine = lines.find((l) => l.startsWith("฿")) ?? "";
            const imgEl = el.querySelector("img") as HTMLImageElement | null;
            const img = imgEl?.src || imgEl?.getAttribute("data-src") || "";
            return { name: lines[0] ?? "", priceLine, link, img };
          });
        })
        .catch(() => []);

      for (const item of domItems) {
        const price = Math.round(parseFloat(item.priceLine.replace(/[^0-9.]/g, "")));
        if (item.name && price > 0) {
          const image = item.img && item.img.startsWith("http") ? item.img : undefined;
          results.push({
            name: item.name,
            price,
            url: item.link || searchUrl,
            inStock: true,
            rating: 0,
            reviews: 0,
            image,
          });
        }
      }

      if (results.length === 0) {
        const title = await page.title().catch(() => "?");
        console.log(`[Lazada] DOM empty — page: "${title.slice(0, 60)}"`);
      }
    }
  } catch (err) {
    console.error(`[Lazada] Playwright error "${keyword}":`, (err as Error).message);
  } finally {
    await context.close().catch(() => {});
    await closeBrowser();
  }

  return results;
}

// ─── Entry point ───────────────────────────────────────────────────────────────
export async function scrapeLazada(keyword: string): Promise<ScrapedItem[]> {
  const apiKey = process.env.SCRAPERAPI_KEY;

  if (apiKey) {
    try {
      const results = await scrapeLazadaViaScraperAPI(keyword, apiKey);
      console.log(
        `[Lazada] "${keyword}" → ${results.length} results (ScraperAPI)`
      );
      return results;
    } catch (err) {
      console.error(
        `[Lazada] ScraperAPI failed: ${(err as Error).message} — falling back to Playwright`
      );
    }
  }

  const results = await scrapeLazadaViaPlaywright(keyword);
  console.log(`[Lazada] "${keyword}" → ${results.length} results (Playwright)`);
  return results;
}
