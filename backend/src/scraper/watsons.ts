import { chromium } from "playwright";
import type { ScrapedItem, ScrapedCoupon } from "./shopee.js";

/**
 * Scrape Watsons Thailand (watsons.co.th).
 *
 * Strategy:
 *  1. Homepage warm-up for session cookies.
 *  2. Intercept SAP Hybris / internal product search API:
 *       /api/2.0/.../products/search?query={keyword}
 *       /search/resources/store/.../products?q={keyword}
 *  3. __NEXT_DATA__ SSR fallback (if site uses Next.js).
 *  4. DOM fallback — parse product cards.
 *
 * Price: returned as { value: 299.0 } in full THB — no conversion needed.
 * Product URL: base path relative → prepend https://www.watsons.co.th
 *
 * Products carried: skincare, cosmetics, haircare, vitamins, health supplements,
 *                   personal care, baby care, household.
 */
export async function scrapeWatsons(keyword: string): Promise<ScrapedItem[]> {
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
    extraHTTPHeaders: {
      "accept-language": "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7",
      "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
    },
  });

  const page    = await context.newPage();
  const results: ScrapedItem[] = [];

  try {
    // ── 1. Homepage warm-up ─────────────────────────────────────────────────
    console.log("[Watsons] Visiting homepage...");
    await page.goto("https://www.watsons.co.th/", {
      waitUntil: "domcontentloaded",
      timeout:   30_000,
    });
    await page.waitForTimeout(2_000);

    // ── 2. Register API interceptor BEFORE navigation ───────────────────────
    // Watsons TH uses SAP Hybris Commerce — intercept product search XHR
    const searchUrl = `https://www.watsons.co.th/search?text=${encodeURIComponent(keyword)}`;
    let capturedProducts: any[] = [];

    page.on("response", async (resp) => {
      const url = resp.url();
      if (resp.status() !== 200 || capturedProducts.length > 0) return;

      const isProductApi =
        (url.includes("watsons.co.th") || url.includes("watsons.com")) &&
        (
          url.includes("/products/search")    ||
          url.includes("/search/resources")   ||
          url.includes("/api/2.0/")           ||
          url.includes("/storefront/")        ||
          (url.includes("/search") && url.includes("q="))
        );

      if (!isProductApi) return;

      try {
        const data = await resp.json();
        // SAP Hybris standard response + fallback paths
        const prods: any[] =
          data?.products           ??
          data?.data?.products     ??
          data?.searchResult?.products ??
          data?.results            ??
          data?.items              ??
          [];

        if (prods.length > 0) {
          capturedProducts = prods;
          console.log(`[Watsons] API captured ${prods.length} items from ${url.slice(0, 80)}`);
        }
      } catch { /* freed */ }
    });

    // ── 3. Navigate to search page ──────────────────────────────────────────
    console.log(`[Watsons] Searching "${keyword}"...`);
    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout:   35_000,
    });

    // ── 3b. __NEXT_DATA__ SSR check ─────────────────────────────────────────
    if (capturedProducts.length === 0) {
      const ssrData = await page.evaluate(() => {
        try {
          const nd = (window as any).__NEXT_DATA__;
          return (
            nd?.props?.pageProps?.products     ??
            nd?.props?.pageProps?.searchResult?.products ??
            nd?.props?.pageProps?.initialData?.products  ??
            []
          );
        } catch { return []; }
      }).catch(() => [] as any[]);

      if (ssrData.length > 0) {
        capturedProducts = ssrData;
        console.log(`[Watsons] SSR __NEXT_DATA__ captured ${ssrData.length} items`);
      }
    }

    // Scroll to trigger lazy-loading + XHR batches
    for (let y = 0; y <= 2_000; y += 400) {
      try { await page.evaluate((s) => window.scrollTo(0, s), y); } catch { break; }
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(2_000);

    // ── 4. Parse API results ────────────────────────────────────────────────
    if (capturedProducts.length > 0) {
      for (const item of capturedProducts.slice(0, 15)) {
        const name = String(
          item.name ?? item.title ?? item.displayName ?? item.productName ?? ""
        ).trim();

        // SAP Hybris: price as { value: 299.0 } or direct number
        const priceVal =
          item.price?.value          ??
          item.basePrice?.value      ??
          item.discountedPrice?.value ??
          item.promotionPrice?.value ??
          item.currentPrice          ??
          item.salePrice             ??
          item.price                 ??
          0;
        const price = Math.round(
          parseFloat(String(priceVal).replace(/[^0-9.]/g, "")) || 0
        );
        if (!name || !price) continue;

        // URL: relative path → absolute
        const rawUrl = item.url ?? item.slug ?? item.permalink ?? "";
        const url = rawUrl
          ? rawUrl.startsWith("http")
            ? rawUrl
            : `https://www.watsons.co.th${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`
          : searchUrl;

        // Stock
        const stockStatus =
          item.stock?.stockLevelStatus ??
          item.stockStatus             ??
          "inStock";
        const inStock = typeof stockStatus === "string"
          ? !stockStatus.toLowerCase().includes("outof")
          : item.inStock !== false;

        // ── Coupon: potentialPromotions from SAP Hybris ───────────────
        let coupon: ScrapedCoupon | undefined;
        const promos: any[] = item.potentialPromotions ?? [];
        if (promos.length > 0) {
          const promo = promos[0];
          const pct        = parseFloat(promo.percentDiscount ?? promo.discountPercent ?? 0) || 0;
          const fixedVal   = parseFloat(promo.discountedPrice?.value ?? promo.discountValue?.value ?? 0) || 0;
          // fixedVal from Watsons is often the DISCOUNTED PRICE, not the discount amount
          // So derive discount = price - fixedVal when fixedVal looks like a price (> 10)
          const discount   = pct  ? Math.round(price * pct / 100)
                           : fixedVal > 0 && fixedVal < price ? Math.round(price - fixedVal)
                           : 0;
          const desc = String(promo.description ?? promo.promotionType ?? "");
          if (discount > 0) {
            coupon = {
              description: desc || (pct ? `สมาชิกลด ${pct}%` : `ลด ฿${discount}`),
              discount: pct ? 0 : discount,
              discountPct: pct,
              minSpend: 0,
              afterPrice: Math.max(0, price - discount),
            };
          }
        }

        // SAP Hybris image structure: item.images = [{ url, format }]
        // Prefer "product" format (mid-size), fall back to any available
        const images: any[] = item.images ?? [];
        const imgEntry =
          images.find((i) => i.format === "product") ??
          images.find((i) => i.format === "thumbnail") ??
          images[0];
        const imgRaw = imgEntry?.url ?? item.thumbnail ?? item.image ?? "";
        const image = imgRaw
          ? imgRaw.startsWith("http")
            ? imgRaw
            : `https://www.watsons.co.th${imgRaw.startsWith("/") ? "" : "/"}${imgRaw}`
          : undefined;

        results.push({
          name,
          price,
          url,
          inStock,
          rating:  parseFloat(item.averageRating ?? item.rating ?? "0") || 0,
          reviews: parseInt(item.numberOfReviews ?? item.reviewCount ?? item.reviews ?? "0") || 0,
          image,
          coupon,
        });
      }

      console.log(`[Watsons] Parsed ${results.length} products from API`);
    }

    // ── 5. DOM fallback ─────────────────────────────────────────────────────
    if (results.length === 0) {
      console.log("[Watsons] API empty — trying DOM...");
      await page.waitForTimeout(2_000);

      const domItems = await page.evaluate(() => {
        const selectors = [
          "[class*='ProductCard']",
          "[class*='product-card']",
          "[class*='product-item']",
          "[class*='ProductItem']",
          "[class*='product_card']",
          "[data-testid*='product']",
          ".product-card",
          ".product-item",
        ];
        let cards: Element[] = [];
        for (const sel of selectors) {
          const found = Array.from(document.querySelectorAll(sel));
          if (found.length > 0) { cards = found; break; }
        }

        return cards.slice(0, 15).map((card) => {
          const el      = card as HTMLElement;
          const nameEl  = el.querySelector(
            "[class*='name'],[class*='Name'],[class*='title'],[class*='Title'],h2,h3,h4,p"
          );
          const priceEl = el.querySelector(
            "[class*='price'],[class*='Price'],[class*='amount'],[class*='Amount']"
          );
          const linkEl  = el.querySelector("a[href]") as HTMLAnchorElement | null;

          const name     = nameEl?.textContent?.trim().replace(/\s+/g, " ") ?? "";
          const priceStr = (priceEl?.textContent ?? "").replace(/[^0-9]/g, "");
          const price    = parseInt(priceStr, 10) || 0;
          const url      = linkEl?.href ?? "";
          const imgEl    = el.querySelector("img") as HTMLImageElement | null;
          const image    = imgEl?.src || imgEl?.getAttribute("data-src") || "";

          return { name, price, url, image };
        });
      }).catch(() => [] as { name: string; price: number; url: string; image: string }[]);

      for (const item of domItems) {
        if (item.name && item.price > 0) {
          const image = item.image && item.image.startsWith("http") ? item.image : undefined;
          results.push({
            name:    item.name,
            price:   item.price,
            url:     item.url || searchUrl,
            inStock: true,
            rating:  0,
            reviews: 0,
            image,
          });
        }
      }

      if (results.length === 0) {
        const title = await page.title().catch(() => "?");
        console.log(`[Watsons] DOM empty — page: "${title.slice(0, 70)}"`);
      } else {
        console.log(`[Watsons] DOM fallback got ${results.length} products`);
      }
    }

  } catch (err) {
    console.error(`[Watsons] Error "${keyword}":`, (err as Error).message);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    console.log("[Watsons] Browser closed");
  }

  console.log(`[Watsons] "${keyword}" → ${results.length} results`);
  return results;
}
