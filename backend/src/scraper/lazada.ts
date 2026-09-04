import { createContext, closeBrowser } from "./browser.js";
import type { ScrapedItem } from "./shopee.js";

/**
 * Scrape Lazada Thailand.
 *
 * Strategy:
 *  1. Visit Lazada homepage to establish a trusted browser session (cookies).
 *  2. Navigate to the search page — Lazada's JS fires an internal AJAX request.
 *  3. Capture that AJAX response via waitForResponse (explicit, no race condition).
 *  4. DOM fallback if AJAX is not intercepted within the timeout.
 *  5. Close browser after each call for a fresh fingerprint next time.
 */
export async function scrapeLazada(keyword: string): Promise<ScrapedItem[]> {
  const context = await createContext(true); // useProxy on Railway if SCRAPERAPI_KEY is set
  const page = await context.newPage();
  const results: ScrapedItem[] = [];

  try {
    // ── 1. Homepage ──────────────────────────────────────────────────────────
    console.log("[Lazada] Visiting homepage for cookies...");
    await page.goto("https://www.lazada.co.th/", {
      waitUntil: "domcontentloaded",
      timeout: 25_000,
    });
    await page.waitForTimeout(1_500);

    // ── 2. Set up AJAX response listener BEFORE navigating to search ─────────
    // Lazada often redirects /catalog/?q=X to /tag/X-keyword/ — so we must
    // listen for ajax=true on EITHER path.  Both carry the same mods.listItems
    // payload with icons + querystring voucher data.
    const searchUrl =
      `https://www.lazada.co.th/catalog/?q=${encodeURIComponent(keyword)}&sort=popularity`;

    const apiWaiter = page.waitForResponse(
      (resp) =>
        resp.url().includes("lazada.co.th") &&
        resp.url().includes("ajax=true") &&
        (resp.url().includes("/catalog") || resp.url().includes("/tag/")) &&
        resp.status() === 200,
      { timeout: 20_000 }
    ).catch(() => null); // null = timed out (no AJAX fired)

    // ── 3. Navigate to search page ───────────────────────────────────────────
    console.log(`[Lazada] Searching for "${keyword}"...`);
    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    // Scroll to trigger AJAX load
    for (let y = 0; y <= 1500; y += 300) {
      await page.evaluate((sy) => window.scrollTo(0, sy), y);
      await page.waitForTimeout(400);
    }

    // ── 4. Await the captured API response ───────────────────────────────────
    const apiResp = await apiWaiter;
    if (apiResp) {
      try {
        const data = await apiResp.json();
        const items: any[] = data?.mods?.listItems ?? data?.rgn?.listItems ?? [];
        if (items.length > 0) {
          console.log(`[Lazada] API captured ${items.length} items`);
          for (const item of items.slice(0, 12)) {
            const rawPrice = item.price ?? item.priceShow ?? "";
            const price = Math.round(parseFloat(String(rawPrice).replace(/[^0-9.]/g, "")));
            if (!price) continue;

            // ── Coupon / Voucher note ─────────────────────────────────────
            // Lazada's search listing API does NOT expose per-product coupons
            // that can be reliably calculated. The "Voucher save X%" badge in
            // item.icons[] merely describes the seller's already-applied discount
            // from originalPrice → price (i.e. the discount is already baked into
            // the price field — applying it again would double-count the saving).
            //
            // Platform coupons (the ones in the 🎟 modal at checkout) require
            // large minimum spends (฿4,999+) and are not product-specific.
            //
            // Therefore: we intentionally do NOT extract coupon data from Lazada.
            // Watsons potentialPromotions (member loyalty discounts) are more
            // reliable and are handled in watsons.ts.

            // Image: protocol-relative URL from CDN (e.g. "//img.lazcdn.com/…")
            const imgRaw = item.image ?? item.img ?? item.thumbnail ?? "";
            const image  = imgRaw
              ? (imgRaw.startsWith("//") ? `https:${imgRaw}` : imgRaw)
              : undefined;

            results.push({
              name: item.name ?? "",
              price,
              url: item.itemUrl ? `https:${item.itemUrl}` : searchUrl,
              inStock: true,
              rating: parseFloat(item.ratingScore ?? "0"),
              reviews: parseInt(item.review ?? "0"),
              image,
              // coupon: intentionally omitted — see comment above
            });
          }
        }
      } catch { /* JSON parse failed */ }
    }

    // ── 5. DOM fallback if AJAX wasn't captured ──────────────────────────────
    if (results.length === 0) {
      console.log("[Lazada] API empty — extracting from DOM...");
      await page.waitForTimeout(2_000); // give page extra time

      const domItems = await page.evaluate(() => {
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
      }).catch(() => []);

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
    console.error(`[Lazada] Error: "${keyword}":`, (err as Error).message);
  } finally {
    await context.close().catch(() => {});
    await closeBrowser(); // fresh fingerprint for next call
  }

  console.log(`[Lazada] "${keyword}" → ${results.length} results`);
  return results;
}
