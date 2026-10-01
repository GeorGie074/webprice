import { chromium } from "playwright";
import { load } from "cheerio";
import type { ScrapedItem } from "./shopee.js";

// Name must contain a real Apple product keyword — rejects UI labels like
// "สี เลือกสีโปรดที่คุณชื่นชอบ" or "พื้นที่จัดเก็บข้อมูล..."
const APPLE_PRODUCT_RE =
  /iphone|ipad|macbook|mac\s*(mini|pro|air|studio)|imac|airpods?|apple\s*watch|apple\s*tv|apple\s*pencil/i;

/**
 * Scrape Apple Store Thailand (apple.com/th).
 *
 * Strategy:
 *  1. Fetch Apple Thailand's shop search API:
 *       https://www.apple.com/th/shop/product/search?q={keyword}&form-type=buyButtons
 *  2. Playwright on apple.com/th/shop/buy-{category}/ — intercept shop API + JSON-LD fallback.
 *
 * Products carried: iPhone, MacBook (Air/Pro), iPad, AirPods, Apple Watch.
 */

const BASE_URL  = "https://www.apple.com";
const SHOP_BASE = `${BASE_URL}/th/shop`;

// ── Shop category URL by keyword ─────────────────────────────────────────────
function shopCategoryUrl(keyword: string): string {
  const kl = keyword.toLowerCase();
  if (/iphone.*17/.test(kl))   return `${SHOP_BASE}/buy-iphone/iphone-17`;
  if (/iphone.*16/.test(kl))   return `${SHOP_BASE}/buy-iphone/iphone-16`;
  if (/iphone.*15/.test(kl))   return `${SHOP_BASE}/buy-iphone/iphone-15`;
  if (/iphone/.test(kl))       return `${SHOP_BASE}/buy-iphone/`;
  if (/macbook.*pro/.test(kl)) return `${SHOP_BASE}/buy-mac/macbook-pro`;
  if (/macbook.*air/.test(kl)) return `${SHOP_BASE}/buy-mac/macbook-air`;
  if (/macbook|imac|mac/.test(kl)) return `${SHOP_BASE}/buy-mac/`;
  if (/ipad.*pro/.test(kl))    return `${SHOP_BASE}/buy-ipad/ipad-pro`;
  if (/ipad.*air/.test(kl))    return `${SHOP_BASE}/buy-ipad/ipad-air`;
  if (/ipad.*mini/.test(kl))   return `${SHOP_BASE}/buy-ipad/ipad-mini`;
  if (/ipad/.test(kl))         return `${SHOP_BASE}/buy-ipad/`;
  if (/airpod/.test(kl))       return `${SHOP_BASE}/buy-airpods/`;
  if (/apple.*watch|watch/.test(kl)) return `${SHOP_BASE}/buy-watch/`;
  if (/apple.*pencil/.test(kl)) return `${SHOP_BASE}/buy-ipad/`;
  return `${SHOP_BASE}/`;
}

// ── Shared HTML parser (used by both ScraperAPI and Playwright paths) ─────────
//
// Apple's buy pages have two layouts:
//  A) Product listing  (/buy-iphone/)      — multiple product cards with names+prices
//  B) Configurator     (/buy-iphone/X/)    — single product with colour/storage selectors
//
// Strategy for (B): grab the page heading as product name + the first price
// that passes the product-name filter.
//
function parseAppleHtml(html: string, fallbackUrl: string): ScrapedItem[] {
  const $ = load(html);
  const results: ScrapedItem[] = [];

  // ── Strategy A: product tile cards ───────────────────────────────────────────
  const cardSels = [
    '[data-autom="sku-list-item"]',
    '[data-autom*="product-tile"]',
    '.rf-bfe-product',
    '[class*="rf-bfe-tile"]',
    '[class*="product-card"]',
    '.as-productrow',
  ];
  for (const sel of cardSels) {
    $(sel).each((_, card) => {
      const nameEl  = $(card).find('[data-autom*="name"], .rf-bfe-productname, h2, h3, h4').first();
      const priceEl = $(card).find('[data-autom*="price"], .rf-bfe-pricepoint, [class*="price"]').first();
      const linkEl  = $(card).find("a[href]").first();

      const name     = nameEl.text().trim().replace(/\s+/g, " ");
      const price    = parseInt(priceEl.text().replace(/[^0-9]/g, ""), 10) || 0;
      const rawHref  = linkEl.attr("href") ?? "";
      const url      = rawHref.startsWith("http") ? rawHref
                     : rawHref ? `${BASE_URL}${rawHref}` : fallbackUrl;

      if (name && price > 0 && APPLE_PRODUCT_RE.test(name)) {
        results.push({ name, price, url, inStock: null, rating: 0, reviews: 0 });
      }
    });
    if (results.length > 0) break;
  }

  // ── Strategy B: configurator page — heading + hero price ─────────────────────
  if (results.length === 0) {
    const heading = $("h1, [data-autom='product-name'], .rc-hero-title")
      .first().text().trim().replace(/\s+/g, " ");

    // Find the first element that has a ฿ price AND is NOT a UI label
    let heroPrice = 0;
    $("*").each((_, el) => {
      if (heroPrice > 0) return false; // stop iterating
      const text = $(el).children().length === 0 ? $(el).text() : ""; // leaf nodes only
      if (text.includes("฿")) {
        const p = parseInt(text.replace(/[^0-9]/g, ""), 10);
        if (p >= 5_000) { heroPrice = p; }
      }
    });

    if (heading && heroPrice > 0 && APPLE_PRODUCT_RE.test(heading)) {
      results.push({
        name:    heading,
        price:   heroPrice,
        url:     fallbackUrl,
        inStock: null,
        rating:  0,
        reviews: 0,
      });
      console.log(`[Apple] Configurator page — extracted "${heading}" ฿${heroPrice}`);
    }
  }

  return results;
}

// ── Approach 0: ScraperAPI (preferred on Railway — bypasses JS restrictions) ───
async function fetchAppleViaScraperAPI(
  keyword: string,
  apiKey: string
): Promise<ScrapedItem[]> {
  const targetUrl  = shopCategoryUrl(keyword);
  const scraperUrl =
    `http://api.scraperapi.com/?api_key=${apiKey}` +
    `&url=${encodeURIComponent(targetUrl)}&render=true&country_code=th`;

  console.log(`[Apple] Fetching via ScraperAPI: "${targetUrl}"...`);
  const res = await fetch(scraperUrl, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`ScraperAPI HTTP ${res.status}`);
  const html = await res.text();

  const items = parseAppleHtml(html, targetUrl);
  if (items.length === 0) throw new Error("ScraperAPI: no Apple products parsed from HTML");
  return items;
}

// ── Approach 1: Apple Thailand shop search API (direct fetch) ─────────────────
async function fetchAppleApi(keyword: string): Promise<ScrapedItem[]> {
  // Thai Apple Shop uses /th/shop/product/search (not /shop/product/search which is US-only)
  const apiUrl =
    `${BASE_URL}/th/shop/product/search?q=${encodeURIComponent(keyword)}` +
    `&form-type=buyButtons&branch=&product=all&src=serp`;

  const resp = await fetch(apiUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
        "(KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      Accept:              "application/json, text/javascript, */*",
      "X-Requested-With":  "XMLHttpRequest",
      Referer:             `${SHOP_BASE}/`,
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const data = await resp.json();
  const products: any[] =
    data?.products ??
    data?.data?.products ??
    data?.results ??
    [];

  if (products.length === 0) throw new Error("no products in API response");

  const results: ScrapedItem[] = [];
  const fallbackUrl = shopCategoryUrl(keyword);

  for (const p of products.slice(0, 15)) {
    const name = String(p.name ?? p.title ?? p.productTitle ?? "").trim();
    const priceRaw = p.price?.currentPrice ?? p.price?.value ?? p.price ?? p.currentPrice ?? "0";
    const price = Math.round(parseFloat(String(priceRaw).replace(/[^0-9.]/g, "")) || 0);
    if (!name || !price) continue;

    const partNumber = p.partNumber ?? p.sku ?? "";
    const url = partNumber
      ? `${BASE_URL}/th/shop/product/${partNumber}`
      : p.url ?? fallbackUrl;

    results.push({
      name,
      price,
      url: url.startsWith("http") ? url : `${BASE_URL}${url}`,
      inStock: p.available !== false && p.inStock !== false,
      rating:  0,
      reviews: 0,
    });
  }

  if (results.length === 0) throw new Error("no usable items");
  return results;
}

// ── Approach 2: Playwright on apple.com/th/shop/buy-{category}/ ───────────────
async function fetchAppleDom(keyword: string): Promise<ScrapedItem[]> {
  let browser: import("playwright").Browser | undefined;
  let context: import("playwright").BrowserContext | undefined;
  const results: ScrapedItem[] = [];

  try {
    browser = await chromium.launch({
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

    context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
        "(KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      locale: "th-TH",
      timezoneId: "Asia/Bangkok",
      viewport: { width: 1366, height: 768 },
    });

    const page       = await context.newPage();
    const targetUrl  = shopCategoryUrl(keyword);
    let capturedItems: any[] = [];

    // Intercept Apple's shop API called by the page
    page.on("response", async (resp) => {
      const url = resp.url();
      if (
        resp.status() === 200 &&
        capturedItems.length === 0 &&
        (url.includes("apple.com/th/shop/product/search") ||
          url.includes("apple.com/shop/product/search") ||
          url.includes("apple.com/th/shop/search") ||
          (url.includes("apple.com") && url.includes("/shop/") && url.includes("search")))
      ) {
        try {
          const data = await resp.json();
          const prods: any[] = data?.products ?? data?.data?.products ?? data?.results ?? [];
          if (prods.length > 0) {
            capturedItems = prods;
            console.log(`[Apple] Shop API intercepted ${prods.length} items`);
          }
        } catch { /* freed */ }
      }
    });

    console.log(`[Apple] Navigating to shop: "${targetUrl}"...`);
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 35_000 });

    for (let y = 0; y <= 2_400; y += 400) {
      try { await page.evaluate((s) => window.scrollTo(0, s), y); } catch { break; }
      await page.waitForTimeout(350);
    }
    await page.waitForTimeout(2_000);

    // ── Parse intercepted shop API data ──────────────────────────────────────
    if (capturedItems.length > 0) {
      for (const p of capturedItems.slice(0, 15)) {
        const name = String(p.name ?? p.title ?? p.productTitle ?? "").trim();
        const priceRaw = p.price?.currentPrice ?? p.price?.value ?? p.price ?? p.currentPrice ?? "0";
        const price = Math.round(parseFloat(String(priceRaw).replace(/[^0-9.]/g, "")) || 0);
        if (!name || !price) continue;

        const partNumber = p.partNumber ?? p.sku ?? "";
        const url = partNumber
          ? `${BASE_URL}/th/shop/product/${partNumber}`
          : p.url ?? targetUrl;

        results.push({
          name,
          price,
          url: url.startsWith("http") ? url : `${BASE_URL}${url}`,
          inStock: p.available !== false && p.inStock !== false,
          rating:  0,
          reviews: 0,
        });
      }
    }

    // ── JSON-LD structured data (more reliable than class names) ─────────────
    if (results.length === 0) {
      const jsonLdItems = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        const out: { name: string; price: number; url: string }[] = [];
        for (const script of scripts) {
          try {
            const raw = JSON.parse(script.textContent || "{}");
            const items: any[] = Array.isArray(raw) ? raw : [raw];
            for (const item of items) {
              if (item["@type"] !== "Product" && item["@type"] !== "IndividualProduct") continue;
              const name  = String(item.name ?? "").trim();
              const priceVal = item.offers?.price ?? item.offers?.lowPrice ?? 0;
              const price = Math.round(parseFloat(String(priceVal)) || 0);
              if (name && price > 0)
                out.push({ name, price, url: item.offers?.url ?? "" });
            }
          } catch { /* skip bad script */ }
        }
        return out;
      }).catch(() => [] as { name: string; price: number; url: string }[]);

      for (const item of jsonLdItems) {
        results.push({
          name:    item.name,
          price:   item.price,
          url:     item.url || targetUrl,
          inStock: null,
          rating:  0,
          reviews: 0,
        });
      }
    }

    // ── DOM fallback — parse full page HTML with shared Cheerio parser ──────────
    if (results.length === 0) {
      console.log("[Apple] JSON-LD empty — trying DOM (Cheerio)...");
      const html = await page.content().catch(() => "");
      const domItems = parseAppleHtml(html, targetUrl);
      results.push(...domItems);

      if (results.length === 0) {
        const title = await page.title().catch(() => "?");
        console.log(`[Apple] No results — page: "${title.slice(0, 60)}"`);
      }
    }

  } catch (err) {
    console.error(`[Apple] DOM error "${keyword}":`, (err as Error).message);
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    console.log("[Apple] Browser closed");
  }

  return results;
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function scrapeApple(keyword: string): Promise<ScrapedItem[]> {
  if (!APPLE_PRODUCT_RE.test(keyword)) {
    console.log(`[Apple] Skipping "${keyword}" — not an Apple product`);
    return [];
  }

  // 1. Direct shop search API (fastest, no browser needed)
  const apiResults = await fetchAppleApi(keyword).catch((e) => {
    console.warn(`[Apple] API fetch failed ("${keyword}"):`, e.message);
    return [] as ScrapedItem[];
  });
  if (apiResults.length > 0) {
    console.log(`[Apple] "${keyword}" → ${apiResults.length} results (API)`);
    return apiResults;
  }

  // 2. ScraperAPI (reliable on Railway — rendered HTML, no CAPTCHA)
  const scraperApiKey = process.env.SCRAPERAPI_KEY;
  if (scraperApiKey) {
    const scraperResults = await fetchAppleViaScraperAPI(keyword, scraperApiKey).catch((e) => {
      console.warn(`[Apple] ScraperAPI failed ("${keyword}"):`, e.message);
      return [] as ScrapedItem[];
    });
    if (scraperResults.length > 0) {
      console.log(`[Apple] "${keyword}" → ${scraperResults.length} results (ScraperAPI)`);
      return scraperResults;
    }
  }

  // 3. Playwright (local dev fallback)
  const domResults = await fetchAppleDom(keyword).catch((err) => {
    console.error(`[Apple] DOM fallback failed ("${keyword}"):`, (err as Error).message);
    return [] as ScrapedItem[];
  });
  console.log(`[Apple] "${keyword}" → ${domResults.length} results (DOM)`);
  return domResults;
}
