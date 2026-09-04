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

/**
 * Parse products from any JSON blob embedded in <script> tags.
 * Tries multiple patterns Lazada has used over time.
 */
function extractFromScript(html: string): ScrapedItem[] | null {
  // Pattern 1: "listItems":[...]  (AJAX / SSR response embedded in page)
  // Pattern 2: mods.listItems inside __INITIAL_STATE__ or similar global
  const patterns = [
    /"listItems"\s*:\s*(\[[\s\S]*?\])\s*[,}]/,
    /listItems['"]\s*:\s*(\[[\s\S]*?\])\s*[,}]/,
  ];

  for (const rx of patterns) {
    const m = html.match(rx);
    if (!m) continue;
    try {
      const items: any[] = JSON.parse(m[1]);
      if (!Array.isArray(items) || items.length === 0) continue;
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
      if (results.length > 0) return results;
    } catch { continue; }
  }
  return null;
}

/**
 * Parse product cards from the rendered DOM.
 * Uses multiple selector strategies + a price-anchor fallback for
 * when Lazada rotates their minified CSS class names.
 */
function extractFromDom(html: string, searchUrl: string): ScrapedItem[] {
  const $ = load(html);
  const results: ScrapedItem[] = [];

  // ── Diagnostic: log title + selector hit counts (visible in Railway logs) ──
  const pageTitle = $("title").text().trim();
  const diagSelectors: Record<string, number> = {
    '[data-tracking="product-card"]': $('[data-tracking="product-card"]').length,
    "[data-item-id]": $("[data-item-id]").length,
    "[data-spm]": $("[data-spm]").length,
    "a[href*='/products/']": $("a[href*='/products/']").length,
    "[class*=product]": $("[class*=product]").length,
  };
  console.log(`[Lazada] Page title: "${pageTitle.slice(0, 80)}"`);
  console.log(`[Lazada] HTML length: ${html.length}`);
  console.log(`[Lazada] Selectors:`, JSON.stringify(diagSelectors));

  // Strategy 1: known structural selectors
  const selectors = [
    '[data-tracking="product-card"]',
    "[data-item-id]",
    "[class*=Bm3ON]",
    '[class*="product-card"]',
    '[class*="product-item"]',
  ];
  let cards: any[] = [];
  for (const sel of selectors) {
    const found = $(sel).toArray();
    if (found.length > 0) { cards = found; break; }
  }

  // Strategy 2: price-anchor fallback — find <a> links that point to Lazada
  // product pages and contain a ฿ price somewhere nearby.
  if (cards.length === 0) {
    console.log("[Lazada] No structural cards — trying price-anchor fallback");
    const productLinks = $("a[href]").toArray().filter((a) => {
      const href = $(a).attr("href") ?? "";
      return (
        href.includes("/products/") ||
        href.includes("lazada.co.th/") ||
        href.includes("i.lazada.co.th")
      );
    });
    for (const a of productLinks.slice(0, 20)) {
      const el  = $(a);
      const txt = el.text().trim();
      const priceMatch = txt.match(/฿\s*([\d,]+)/);
      if (!priceMatch) continue;
      const price = Math.round(parseFloat(priceMatch[1].replace(/,/g, "")));
      if (!price || price < 100) continue;
      const name = txt.replace(/฿[\d,]+.*/, "").trim().split("\n")[0].trim();
      if (!name || name.length < 3) continue;
      const href = $(a).attr("href") ?? "";
      results.push({
        name,
        price,
        url: href.startsWith("http") ? href : `https:${href}`,
        inStock: true,
        rating: 0,
        reviews: 0,
      });
      if (results.length >= 12) break;
    }
    return results;
  }

  // Parse structural cards normally
  for (const card of cards.slice(0, 12)) {
    const el   = $(card);
    const text = el.text();
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const priceLine = lines.find((l) => l.startsWith("฿")) ?? "";
    const price = Math.round(parseFloat(priceLine.replace(/[^0-9.]/g, "")));
    if (!price) continue;
    const link  = el.find("a").first().attr("href") ?? "";
    const imgEl = el.find("img").first();
    const img   = imgEl.attr("src") || imgEl.attr("data-src") || "";
    const name  = lines[0] ?? "";
    if (!name) continue;
    results.push({
      name,
      price,
      url: link ? (link.startsWith("http") ? link : `https:${link}`) : searchUrl,
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
  // Strategy: render=true + premium=true + wait=3000
  //
  // Why each flag matters for Lazada:
  //  - render=true  → executes Lazada's React JS so products appear in DOM
  //  - premium=true → uses residential proxy IPs (real home/mobile IPs).
  //                   Lazada blocks datacenter IPs but cannot block residential ones.
  //  - wait=3000    → waits 3 s after React renders for lazy-loaded product cards
  //
  // Cost: ~25 credits/request on ScraperAPI (vs 1 for plain fetch).
  // With 5,000 free credits: ~200 Lazada Live Searches per month.
  const lazadaUrl = `https://www.lazada.co.th/catalog/?q=${encodeURIComponent(keyword)}&sort=popularity`;
  const scraperUrl =
    `http://api.scraperapi.com/?api_key=${apiKey}` +
    `&url=${encodeURIComponent(lazadaUrl)}` +
    `&render=true&premium=true&wait=3000&country_code=th`;

  console.log(`[Lazada] ScraperAPI render=true + premium (residential IP)...`);
  const res = await fetch(scraperUrl, {
    // Premium rendering can take up to 90 s
    signal: AbortSignal.timeout(100_000),
  });
  if (!res.ok) throw new Error(`ScraperAPI HTTP ${res.status}`);
  const html = await res.text();

  // 1. Try embedded JSON — Lazada's SSR often serialises listItems into a <script>
  const fromScript = extractFromScript(html);
  if (fromScript && fromScript.length > 0) {
    console.log(`[Lazada] Got ${fromScript.length} items from embedded JSON`);
    return fromScript;
  }

  // 2. Fall back to Cheerio DOM parsing of rendered product cards
  const fromDom = extractFromDom(html, lazadaUrl);
  if (fromDom.length > 0) {
    console.log(`[Lazada] Got ${fromDom.length} items from rendered DOM`);
  } else {
    console.log("[Lazada] render+premium returned no parseable products");
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
      // Do NOT fall back to Playwright on Railway (headless mode).
      // Headless Chrome + Lazada always fails — empty page, wasted browser resources.
      // BNN and JIB still provide results; return empty and move on.
      console.error(`[Lazada] ScraperAPI failed: ${(err as Error).message}`);
      console.log("[Lazada] Skipping Playwright fallback (headless mode, Lazada blocks it)");
      return [];
    }
  }

  // Local dev (no SCRAPERAPI_KEY): use Playwright in headed mode
  const results = await scrapeLazadaViaPlaywright(keyword);
  console.log(`[Lazada] "${keyword}" → ${results.length} results (Playwright)`);
  return results;
}
