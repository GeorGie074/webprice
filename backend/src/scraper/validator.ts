/**
 * validator.ts — Data quality guard for scraped results.
 *
 * Called AFTER bestMatch() selects a candidate, BEFORE saving to MongoDB.
 * Provides a second safety layer against:
 *
 *  1. Accessories saved as products (screen protectors, cases, cables…)
 *  2. Prices wildly off from the product's known price range
 *  3. URLs from the wrong platform (cross-domain scrape pollution)
 *
 * Each check returns { ok, reason } — ok=false means discard the match.
 */
import type { ScrapedItem } from "./shopee.js";

// ── Category-based absolute minimum prices (THB) ──────────────────────────────
// If a scraped price is below this floor, the item is almost certainly an
// accessory (case, film, cable, eartip…) not the device itself.
//
// Set conservatively — a rejected REAL product is worse than an accepted
// accessory that bestMatch() + price-deviation will filter anyway.
export const CATEGORY_MIN_PRICE: Record<string, number> = {
  smartphone: 2_500,   // budget phones start ~฿2,500; screen protectors < ฿1,000
  laptop:     5_000,   // Chromebooks/budget start ~฿5,000; laptop bags < ฿2,000
  tablet:     3_000,   // Android slabs start ~฿3,000; covers/pens < ฿1,500
  audio:        350,   // entry earphones ~฿350; eartips/cables < ฿200
  home:         500,   // basic appliances ~฿500; filter pads < ฿300
  fashion:      300,   // budget sneakers ~฿300; insoles/laces < ฿100
  beauty:        50,   // lip balm / sample-size ~฿50; no strong floor needed
  health:        50,   // single-serve vitamins ~฿50; supplements/devices vary
};

// ── Platform ↔ domain whitelist ────────────────────────────────────────────────
// Ensures a scraped URL actually belongs to the platform we scraped.
// Catches cases where a scraper accidentally returns a link from another site
// (redirects, affiliate links, wrong API field, etc.).
const PLATFORM_DOMAIN: Record<string, string> = {
  "Shopee":         "shopee.co.th",
  "Lazada":         "lazada.co.th",
  "JIB":            "jib.co.th",
  "Power Buy":      "powerbuy.co.th",
  "Banana IT":      "bnn.in.th",
  "Studio 7":       "studio7thailand.com",
  "Central Online": "central.co.th",
  "Nike.com":       "nike.com",
  "Samsung Shop":   "samsung.com",
  "Apple Store":    "apple.com",
  "Sony Store":     "sony.co.th",
  "Dyson Store":    "dyson.co.th",
  "Watsons":        "watsons.co.th",
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a scraped price.
 *
 * @param price    Scraped price in Thai Baht.
 * @param category Product category string (e.g. "smartphone").
 * @param refPrice Known reference price (originalPrice or maxPrice); 0 = unknown.
 */
export function checkPrice(
  price: number,
  category: string,
  refPrice: number
): { ok: boolean; reason?: string } {
  // Must be a positive number
  if (!price || price <= 0)
    return { ok: false, reason: `invalid price ฿${price}` };

  // 1. Category floor — primary guard against accessories
  const catMin = CATEGORY_MIN_PRICE[category];
  if (catMin !== undefined && price < catMin)
    return {
      ok: false,
      reason: `฿${price.toLocaleString()} < category floor ฿${catMin.toLocaleString()} (${category}) — likely accessory`,
    };

  // 2. Deviation from known reference price (skip when refPrice unknown)
  //    • < 15 % of ref  → accessory or massively discounted knockoff
  //    • > 400 % of ref → wrong product (much more expensive variant / bundle)
  if (refPrice > 0) {
    if (price < refPrice * 0.15)
      return {
        ok: false,
        reason: `฿${price.toLocaleString()} < 15% of ref ฿${refPrice.toLocaleString()} — likely accessory/wrong item`,
      };
    if (price > refPrice * 4)
      return {
        ok: false,
        reason: `฿${price.toLocaleString()} > 4× ref ฿${refPrice.toLocaleString()} — likely wrong item`,
      };
  }

  return { ok: true };
}

/**
 * Validate that a scraped URL belongs to the expected platform domain.
 * Catches cross-domain links (wrong API field, redirect pollution, etc.).
 */
export function checkUrl(
  url: string,
  platform: string
): { ok: boolean; reason?: string } {
  if (!url || !url.trim())
    return { ok: false, reason: "empty URL" };

  const expected = PLATFORM_DOMAIN[platform];
  if (!expected) return { ok: true }; // no rule defined → pass through

  if (!url.includes(expected))
    return {
      ok: false,
      reason: `"${url.slice(0, 70)}" is not a ${platform} URL (expected domain: ${expected})`,
    };

  return { ok: true };
}

/**
 * Run both price and URL checks on a scraped match.
 * Returns the original match unchanged if it passes, null if rejected.
 *
 * @param match       Output of bestMatch() — may already be null.
 * @param platform    Platform name string (e.g. "Lazada").
 * @param productName Product name for console warning context.
 * @param category    Product category for price floor lookup.
 * @param refPrice    Reference price (originalPrice or maxPrice); 0 = unknown.
 */
export function validateMatch(
  match: ScrapedItem | null,
  platform: string,
  productName: string,
  category: string,
  refPrice: number
): ScrapedItem | null {
  if (!match) return null;

  const priceCheck = checkPrice(match.price, category, refPrice);
  if (!priceCheck.ok) {
    console.warn(`[Validator][${platform}] "${productName}": ${priceCheck.reason}`);
    return null;
  }

  const urlCheck = checkUrl(match.url, platform);
  if (!urlCheck.ok) {
    console.warn(`[Validator][${platform}] "${productName}": ${urlCheck.reason}`);
    return null;
  }

  return match; // ✅ both checks passed
}
