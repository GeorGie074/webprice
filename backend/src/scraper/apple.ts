import { chromium } from "playwright";
import type { ScrapedItem } from "./shopee.js";

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

    // ── DOM fallback — Apple shop product tile selectors ─────────────────────
    if (results.length === 0) {
      console.log("[Apple] JSON-LD empty — trying DOM...");

      const domItems = await page.evaluate(() => {
        // Apple's Buy Flow Engine (BFE) classes + broader fallback
        const cards = Array.from(document.querySelectorAll(
          ".rf-bfe-product, [class*='rf-bfe'], " +
          "[data-analytics-title], " +
          ".rc-product-card, [class*='product-card'], " +
          ".as-productrow, li[class*='product'], " +
          "[class*='product-tile'], [class*='ProductTile']"
        )).filter((el) => {
          const text = (el as HTMLElement).innerText || "";
          return text.includes("฿") || text.includes("บาท");
        });

        return cards.slice(0, 15).map((card) => {
          const nameEl  = card.querySelector(
            ".rf-bfe-productname, [class*='product-name'], " +
            "[class*='product-title'], h2, h3, h4, [data-analytics-title]"
          );
          const priceEl = card.querySelector(
            ".rf-bfe-finalPrice, .rf-bfe-pricepoint-currentPrice, " +
            "[class*='price'], [class*='Price'], " +
            "[class*='currentPrice'], [class*='current-price']"
          );
          const linkEl  = card.querySelector("a[href]") as HTMLAnchorElement | null;

          const name     = (nameEl?.textContent ?? card.getAttribute("data-analytics-title") ?? "").trim().replace(/\s+/g, " ");
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
            inStock: null,
            rating:  0,
            reviews: 0,
          });
      }

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
  if (!/iphone|ipad|macbook|mac\s*(mini|pro|air|studio)|imac|airpod|apple\s*watch|apple\s*pencil|apple\s*tv/i.test(keyword)) {
    console.log(`[Apple] Skipping "${keyword}" — not an Apple product`);
    return [];
  }

  const apiResults = await fetchAppleApi(keyword).catch((e) => {
    console.warn(`[Apple] API fetch failed ("${keyword}"):`, e.message);
    return [] as ScrapedItem[];
  });

  if (apiResults.length > 0) {
    console.log(`[Apple] "${keyword}" → ${apiResults.length} results (API)`);
    return apiResults;
  }

  const domResults = await fetchAppleDom(keyword).catch((err) => {
    console.error(`[Apple] DOM fallback failed ("${keyword}"):`, (err as Error).message);
    return [] as ScrapedItem[];
  });
  console.log(`[Apple] "${keyword}" → ${domResults.length} results (DOM)`);
  return domResults;
}
