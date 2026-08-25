import Product, { IPlatformPrice } from "../models/Product.js";
import Alert from "../models/Alert.js";
import User from "../models/User.js";
import { scrapeShopee, ScrapedItem } from "./shopee.js";
import { scrapeLazada } from "./lazada.js";
import { scrapeBNN } from "./bnn.js";
import { scrapePowerBuy } from "./powerbuy.js";
import { scrapeStudio7 } from "./studio7.js";
import { scrapeJIB } from "./jib.js";
import { scrapeSamsung } from "./samsung.js";
import { scrapeSony } from "./sony.js";
import { scrapeDyson } from "./dyson.js";
import { scrapeCentral } from "./central.js";
import { scrapeNike } from "./nike.js";
import { scrapeApple } from "./apple.js";
import { scrapeWatsons } from "./watsons.js";
import { validateMatch } from "./validator.js";
import { sendPriceAlertEmail } from "../utils/mailer.js";
import { sendLineNotify, buildPriceAlertMessage } from "../utils/lineNotify.js";

// ─── Scraper progress (in-memory singleton, resets per run) ──────────────────
export interface ScraperProgress {
  isRunning:      boolean;
  total:          number;
  done:           number;
  failed:         number;
  currentProduct: string;
  startedAt:      string | null;
  finishedAt:     string | null;
}

export const scraperProgress: ScraperProgress = {
  isRunning:      false,
  total:          0,
  done:           0,
  failed:         0,
  currentProduct: "",
  startedAt:      null,
  finishedAt:     null,
};

/**
 * Score how well a scraped item matches the product name.
 * Returns number of matching keywords (higher = better match).
 */
function nameScore(scrapedName: string, productName: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9฀-๿]/g, " ").split(/\s+/).filter(Boolean);
  const keywords = normalize(productName);
  const words = normalize(scrapedName);
  return keywords.filter((k) => words.some((w) => w.includes(k) || k.includes(w))).length;
}

/**
 * Find the best-matching item from scraped results.
 * Rules:
 *  1. Price must be within 30%–250% of the original MSRP.
 *  2. Score must be ≥ 50% of keyword count (prevent false positives like
 *     "Reno 15 Pro" matching "iPhone 15 Pro Max" via shared words).
 *  3. The first keyword (brand/model identifier) MUST appear in the name.
 *  4. Category floor: items below the absolute minimum for this category
 *     are dropped before scoring (accessories like cases/films/cables).
 */
function bestMatch(
  items: ScrapedItem[],
  productName: string,
  existingPrice: number,
  categoryMin = 0       // absolute minimum price for this product's category
): ScrapedItem | null {
  if (!items.length) return null;

  // ── Layer 0: Category floor (fastest reject — no regex needed) ───────────
  // Drop items below the absolute minimum for this product category before
  // any name-scoring. This removes accessories (cases, films, cables…) that
  // share model keywords but cost a fraction of the device price.
  const pool0 = categoryMin > 0 ? items.filter((i) => i.price >= categoryMin) : items;
  if (pool0.length === 0) {
    console.log(`[matcher] All ${items.length} items for "${productName}" below category floor ฿${categoryMin}`);
    return null;
  }
  const itemsFiltered = pool0;

  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9฀-๿]/g, " ").split(/\s+/).filter(Boolean);

  const keywords = normalize(productName);
  const minScore = Math.ceil(keywords.length * 0.6); // need ≥60% match — prevents base "iPhone 15" matching "iPhone 15 Pro Max"
  const mustMatch = keywords[0]; // brand keyword (e.g. "iphone", "sony", "dyson")

  // mustMatch2: second keyword if it's ≥4 chars (product family like "galaxy", "iphone", "macbook")
  // prevents accessories like "S Pen Samsung S25" matching "Samsung Galaxy S25"
  // because S Pen title has "samsung" + "s25" but NOT "galaxy"
  const mustMatch2 = keywords.length > 1 && keywords[1].length >= 4 ? keywords[1] : null;

  // Variant keywords: product tier/variant indicators that MUST ALL appear in the scraped result
  // Prevents "iPhone 15" base matching "iPhone 15 Pro Max", MacBook Pro matching MacBook Air, etc.
  // Also used for NEGATIVE check: if scraped result contains a variant word that the product
  // doesn't have, reject it (e.g. "Galaxy S25 FE" must not match "Galaxy S25").
  const VARIANT_WORDS = new Set([
    "pro", "max", "plus", "ultra", "mini", "lite", "air",
    "edge", "note", "fold", "flip", "active", "classic",
    "fe", "se",        // Fan Edition / Special Edition (Samsung S25 FE, iPhone SE)
    "cellular",        // iPad WiFi+Cellular vs WiFi-only
  ]);
  const variantKws = keywords.filter((k) => VARIANT_WORDS.has(k));

  // Primary model IDs — must ALL appear in scraped result:
  //   Type A: alphanumeric tokens (letters+digits): "s26", "m3", "g14", "xm6"  (NOT storage like "256gb")
  //   Type B: pure numbers ≥ 2 digits but NOT 4-digit years (19xx/20xx):
  //           "15", "17", "270" match (iPhone 15 vs 17, Air Max 270 vs 90)
  //           "2026", "2025" are EXCLUDED — they're release years, not model IDs.
  //           Listing titles often omit or use a different year (e.g. "G14 (2025)" ≠ "G14 2026").
  const primaryModelIds = keywords.filter(
    (k) =>
      (/[a-z]/.test(k) && /[0-9]/.test(k) && !/^\d+[gtm]b$/.test(k)) || // alphanumeric, not storage
      (/^\d{2,}$/.test(k) && !/^(19|20)\d{2}$/.test(k))                  // pure numbers, NOT 4-digit years
  );

  // Sanity: price range (when existingPrice=0 on a new product, use a very wide range)
  // Lower bound is 50% of MSRP (not 30%) to filter out accessories that share the product's
  // model name but cost a fraction of the price (e.g. keyboard cases for iPad, phone cases…).
  const refPrice = existingPrice > 0 ? existingPrice : Infinity;
  const sane = itemsFiltered.filter(
    (i) => i.price > (existingPrice > 0 ? existingPrice * 0.5 : 0) && i.price < refPrice * 2.5
  );
  const pool = sane.length > 0 ? sane : itemsFiltered;

  // Score each candidate
  const scored = pool
    .map((i) => {
      const words = normalize(i.name);
      const score = keywords.filter(
        // keyword matches a result word if either contains the other
        (k) => words.some((w) => w.includes(k) || k.includes(w))
      ).length;
      // matchesModelId: scraped word `w` contains product model ID `id`
      // with an extra guard: the character immediately AFTER the match must NOT be a
      // letter — this prevents "16" matching "16e" (iPhone 16 vs iPhone 16e), etc.
      const matchesModelId = (w: string, id: string): boolean => {
        const idx = w.indexOf(id);
        if (idx === -1) return false;
        const after = w[idx + id.length];
        return !after || !/[a-z]/.test(after);
      };
      // Model ID check: ALL primary model IDs must appear in the scraped result.
      const allModelIdsMatch =
        primaryModelIds.length === 0 ||
        primaryModelIds.every((id) => words.some((w) => matchesModelId(w, id)));
      const modelMatch = allModelIdsMatch;
      // mustMatch check: brand must appear OR all model IDs match.
      // The model-ID fallback handles stores (e.g. Power Buy) whose product titles
      // omit the brand name: "WH-1000XM6 หูฟังไร้สาย" lacks "Sony" but has "1000xm6".
      const hasBrand = words.some((w) => w === mustMatch || w.includes(mustMatch));
      // mustMatch2 check: product family keyword (e.g. "galaxy") must appear
      // OR all model IDs match — handles Lazada titles like "Samsung S25" (no "Galaxy")
      // that would fail mustMatch2="galaxy" even though they are the right product.
      const hasFamily =
        mustMatch2 === null ||
        words.some((w) => w === mustMatch2 || w.includes(mustMatch2)) ||
        allModelIdsMatch;  // model-ID match compensates for missing family keyword
      const hasMustMatch = (hasBrand || allModelIdsMatch) && hasFamily;
      // Forward variant check: ALL product variant keywords must appear in scraped result
      // prevents "iPhone 15" base matching "iPhone 15 Pro Max", MacBook Air vs Pro, etc.
      const variantMatch =
        variantKws.length === 0 ||
        variantKws.every((v) => words.some((w) => w.includes(v) || v.includes(w)));
      // Negative variant check: scraped result must NOT contain a variant word the product lacks
      // prevents "Galaxy S25 FE" matching "Galaxy S25", "iPad WiFi+Cellular" matching "iPad WiFi"
      // Matches both standalone "fe" AND merged tokens like "fe128" (FE + storage suffix)
      const hasVariantWord = (wordList: string[], v: string) =>
        wordList.some(
          (w) =>
            w === v ||
            // e.g. "fe128" → startsWith("fe") + rest is digits → treat as variant "fe"
            (w.length > v.length && w.startsWith(v) && /^\d/.test(w.slice(v.length)))
        );
      const noSpuriousVariant = ![...VARIANT_WORDS].some(
        (v) =>
          hasVariantWord(words, v) &&         // scraped name contains this variant
          !keywords.some((k) => k === v)      // but product keywords don't
      );
      // "Plus" via raw "+" suffix: catch "Galaxy S25+" when product is "Galaxy S25".
      // Only fires when "+" appears IMMEDIATELY after one of the product's model IDs in
      // the raw scraped title — so "S25+" triggers it but "RTX 5070 Ti+" does NOT
      // (because "ti" is not a primaryModelId of the product).
      const rawLower = i.name.toLowerCase();
      const hasPlusVariant =
        !keywords.includes("plus") &&   // product itself doesn't ask for "plus"
        primaryModelIds.some((id) => {
          const idx = rawLower.indexOf(id);
          return idx !== -1 && rawLower[idx + id.length] === "+";
        });
      return { item: i, score, hasMustMatch: hasMustMatch && modelMatch && variantMatch && noSpuriousVariant && !hasPlusVariant };
    })
    .filter((c) => c.score >= minScore && c.hasMustMatch) // strict filter
    .sort((a, b) => b.score - a.score || a.item.price - b.item.price);

  if (scored.length === 0) {
    console.log(
      `[matcher] No item passed filter for "${productName}" ` +
      `(need score≥${minScore}, mustMatch="${mustMatch}"${mustMatch2 ? `+"${mustMatch2}"` : ""}, ` +
      `modelIds=[${primaryModelIds.join(",")}], variants=[${variantKws.join(",")}])`
    );
    // Debug: show top 5 candidate names so we can tune the filter
    pool.slice(0, 5).forEach((it, i) =>
      console.log(`  candidate[${i}] ฿${it.price} "${it.name.slice(0, 80)}"`)
    );
    return null;
  }

  console.log(
    `[matcher] Best match for "${productName}": "${scored[0].item.name}" ` +
    `score=${scored[0].score}/${keywords.length} ฿${scored[0].item.price}`
  );
  return scored[0].item;
}

export interface ScrapeResult {
  productId: string;
  productName: string;
  shopee:    { price: number | null; url: string };
  lazada:    { price: number | null; url: string };
  bnn:       { price: number | null; url: string };
  powerBuy:  { price: number | null; url: string };
  studio7:   { price: number | null; url: string };
  jib:       { price: number | null; url: string };
  samsung:   { price: number | null; url: string };
  sony:      { price: number | null; url: string };
  dyson:     { price: number | null; url: string };
  central:   { price: number | null; url: string };
  nike:      { price: number | null; url: string };
  apple:     { price: number | null; url: string };
  watsons:   { price: number | null; url: string };
  success: boolean;
  error?: string;
}

/**
 * Update prices for all products (or a single product by ID).
 * Scrapes Shopee + Lazada concurrently per product, then saves to DB.
 */
export async function updateProductPrices(
  productId?: string
): Promise<ScrapeResult[]> {
  const query = productId ? { _id: productId } : {};
  const products = await Product.find(query);
  const report: ScrapeResult[] = [];

  // ── Initialize progress tracker ────────────────────────────────────────────
  scraperProgress.isRunning      = true;
  scraperProgress.total          = products.length;
  scraperProgress.done           = 0;
  scraperProgress.failed         = 0;
  scraperProgress.currentProduct = "";
  scraperProgress.startedAt      = new Date().toISOString();
  scraperProgress.finishedAt     = null;

  for (const product of products) {
    scraperProgress.currentProduct = product.nameTh || product.name;
    console.log(`\n🔍 Scraping: ${product.name}`);

    const result: ScrapeResult = {
      productId: String(product._id),
      productName: product.name,
      shopee:   { price: null, url: "" },
      lazada:   { price: null, url: "" },
      bnn:      { price: null, url: "" },
      powerBuy: { price: null, url: "" },
      studio7:  { price: null, url: "" },
      jib:      { price: null, url: "" },
      samsung:  { price: null, url: "" },
      sony:     { price: null, url: "" },
      dyson:    { price: null, url: "" },
      central:  { price: null, url: "" },
      nike:     { price: null, url: "" },
      apple:    { price: null, url: "" },
      watsons:  { price: null, url: "" },
      success: false,
    };

    try {
      // Build Lazada search keyword.
      // Use product.searchKeyword if set (custom override), otherwise auto-generate
      // from the first 4 words of the English name (brand + model identifier).
      // Lazada search works better with short brand+model queries.
      const shortEnglish = (product as any).searchKeyword
        || product.name.split(/\s+/).slice(0, 4).join(" ");
      // shortThai: for Watsons searches, prefer the English name if the Thai
      // name starts with a Thai-language descriptor (e.g. "โฟมล้างหน้า CeraVe…").
      // Watsons TH catalog is indexed primarily by brand/English name, so
      // leading Thai text can weaken API relevance rankings.
      // Heuristic: if nameTh starts with a Thai character, use the English name instead.
      const thaiLeadRe = /^[ก-๙]/;
      const shortThai = thaiLeadRe.test(product.nameTh ?? "")
        ? shortEnglish   // fall back to English brand+model
        : (product.nameTh || product.name).split(/\s+/).slice(0, 4).join(" ");

      // ── Shopee (disabled stub — returns [] immediately) ──────────────────
      const shopeeItems = await scrapeShopee(product.name).catch(() => []);

      // ── Lazada ───────────────────────────────────────────────────────────
      let lazadaItems = await scrapeLazada(shortEnglish).catch(() => []);

      // If English short search failed → retry with short Thai name
      if (lazadaItems.length === 0 && shortThai !== shortEnglish) {
        console.log(`[Lazada] English search empty → retrying with Thai: "${shortThai}"`);
        lazadaItems = await scrapeLazada(shortThai).catch(() => []);
      }

      // ── Banana IT ────────────────────────────────────────────────────────
      // BNN uses category-based navigation; use the English keyword.
      // Sequential (not concurrent) because both Lazada and BNN share the
      // same Chromium singleton — running them simultaneously destroys the
      // shared browser mid-scrape.
      // Skip entirely if the product has no Banana IT entry — saves ~20s
      // per product per cycle (homepage warmup + category page navigation).
      const hasBnnEntry = product.prices.some(
        (p) => (p as any).platform === "Banana IT"
      );
      const bnnItems = hasBnnEntry
        ? await scrapeBNN(shortEnglish).catch(() => [])
        : (console.log(`[BNN] Skipping "${product.name}" — no Banana IT entry`), []);

      // ── Power Buy ────────────────────────────────────────────────────────
      // Uses its own playwright-extra + StealthPlugin browser (Cloudflare bypass).
      // Skip if product has no Power Buy entry — saves ~25s browser launch per product.
      const hasPowerBuyEntry = product.prices.some(
        (p) => (p as any).platform === "Power Buy"
      );
      const powerBuyItems = hasPowerBuyEntry
        ? await scrapePowerBuy(shortEnglish).catch(() => [])
        : (console.log(`[PowerBuy] Skipping "${product.name}" — no Power Buy entry`), []);

      // ── Studio 7 ─────────────────────────────────────────────────────────
      // Apple Authorized Reseller — carries Apple products only.
      // Skip if product has no Studio 7 entry.
      const hasStudio7Entry = product.prices.some(
        (p) => (p as any).platform === "Studio 7"
      );
      const studio7Items = hasStudio7Entry
        ? await scrapeStudio7(shortEnglish).catch(() => [])
        : (console.log(`[Studio7] Skipping "${product.name}" — no Studio 7 entry`), []);

      // ── JIB ──────────────────────────────────────────────────────────────
      // JIB Computer — carries IT/electronics products (phones, laptops, headphones…).
      // Skip if product has no JIB entry.
      const hasJIBEntry = product.prices.some(
        (p) => (p as any).platform === "JIB"
      );
      const jibItems = hasJIBEntry
        ? await scrapeJIB(shortEnglish).catch(() => [])
        : (console.log(`[JIB] Skipping "${product.name}" — no JIB entry`), []);

      // ── Samsung Shop ─────────────────────────────────────────────────────
      // samsung.com/th — Samsung branded products only.
      const hasSamsungEntry = product.prices.some(
        (p) => (p as any).platform === "Samsung Shop"
      );
      const samsungItems = hasSamsungEntry
        ? await scrapeSamsung(shortEnglish).catch(() => [])
        : (console.log(`[Samsung] Skipping "${product.name}" — no Samsung Shop entry`), []);

      // ── Sony Store ───────────────────────────────────────────────────────
      // store.sony.co.th (Shopify) — Sony branded products.
      const hasSonyEntry = product.prices.some(
        (p) => (p as any).platform === "Sony Store"
      );
      const sonyItems = hasSonyEntry
        ? await scrapeSony(shortEnglish).catch(() => [])
        : (console.log(`[Sony] Skipping "${product.name}" — no Sony Store entry`), []);

      // ── Dyson ────────────────────────────────────────────────────────────
      // dyson.co.th — Dyson products (vacuums, hair care, air treatment).
      const hasDysonEntry = product.prices.some(
        (p) => (p as any).platform === "Dyson Store"
      );
      const dysonItems = hasDysonEntry
        ? await scrapeDyson(shortEnglish).catch(() => [])
        : (console.log(`[Dyson] Skipping "${product.name}" — no Dyson Store entry`), []);

      // ── Central Online ───────────────────────────────────────────────────
      // central.co.th — general department store (electronics, fashion, home).
      const hasCentralEntry = product.prices.some(
        (p) => (p as any).platform === "Central Online"
      );
      const centralItems = hasCentralEntry
        ? await scrapeCentral(shortEnglish).catch(() => [])
        : (console.log(`[Central] Skipping "${product.name}" — no Central Online entry`), []);

      // ── Nike.com ─────────────────────────────────────────────────────────
      // nike.com/th — Nike shoes and sportswear.
      const hasNikeEntry = product.prices.some(
        (p) => (p as any).platform === "Nike.com"
      );
      const nikeItems = hasNikeEntry
        ? await scrapeNike(shortEnglish).catch(() => [])
        : (console.log(`[Nike] Skipping "${product.name}" — no Nike.com entry`), []);

      // ── Apple Store ──────────────────────────────────────────────────────
      // apple.com/th — Apple products (iPhone, Mac, iPad, AirPods, Watch).
      const hasAppleEntry = product.prices.some(
        (p) => (p as any).platform === "Apple Store"
      );
      const appleItems = hasAppleEntry
        ? await scrapeApple(shortEnglish).catch(() => [])
        : (console.log(`[Apple] Skipping "${product.name}" — no Apple Store entry`), []);

      // ── Watsons ───────────────────────────────────────────────────────────
      // watsons.co.th — beauty, skincare, health, personal care products.
      const hasWatsonsEntry = product.prices.some(
        (p) => (p as any).platform === "Watsons"
      );
      const watsonsItems = hasWatsonsEntry
        ? await scrapeWatsons(shortThai).catch(() => [])
        : (console.log(`[Watsons] Skipping "${product.name}" — no Watsons entry`), []);

      // ── MSRP references for price-sanity checks ───────────────────────
      // Use originalPrice per platform, fall back to product maxPrice.
      // 0 = "brand new product" — skip price filter entirely.
      const shopeeOriginal =
        product.prices.find((p) => p.platform === "Shopee")?.originalPrice ||
        product.maxPrice || 0;
      const lazadaOriginal =
        product.prices.find((p) => p.platform === "Lazada")?.originalPrice ||
        product.maxPrice || 0;
      const bnnOriginal =
        product.prices.find((p) => p.platform === "Banana IT")?.originalPrice ||
        product.maxPrice || 0;
      const powerBuyOriginal =
        product.prices.find((p) => (p as any).platform === "Power Buy")?.originalPrice ||
        product.maxPrice || 0;
      const studio7Original =
        product.prices.find((p) => (p as any).platform === "Studio 7")?.originalPrice ||
        product.maxPrice || 0;
      const jibOriginal =
        product.prices.find((p) => (p as any).platform === "JIB")?.originalPrice ||
        product.maxPrice || 0;
      const samsungOriginal =
        product.prices.find((p) => (p as any).platform === "Samsung Shop")?.originalPrice ||
        product.maxPrice || 0;
      const sonyOriginal =
        product.prices.find((p) => (p as any).platform === "Sony Store")?.originalPrice ||
        product.maxPrice || 0;
      const dysonOriginal =
        product.prices.find((p) => (p as any).platform === "Dyson Store")?.originalPrice ||
        product.maxPrice || 0;
      const centralOriginal =
        product.prices.find((p) => (p as any).platform === "Central Online")?.originalPrice ||
        product.maxPrice || 0;
      const nikeOriginal =
        product.prices.find((p) => (p as any).platform === "Nike.com")?.originalPrice ||
        product.maxPrice || 0;
      const appleOriginal =
        product.prices.find((p) => (p as any).platform === "Apple Store")?.originalPrice ||
        product.maxPrice || 0;
      const watsonsOriginal =
        product.prices.find((p) => (p as any).platform === "Watsons")?.originalPrice ||
        product.maxPrice || 0;

      // ── Category floor (passed to bestMatch as Layer-0 pre-filter) ──────
      // Imported from validator so both bestMatch and validateMatch share the
      // same threshold — avoids two sources of truth.
      const { CATEGORY_MIN_PRICE } = await import("./validator.js");
      const catMin = CATEGORY_MIN_PRICE[product.category] ?? 0;

      const searchKw = (product as any).searchKeyword as string | undefined;

      const shopeeMatch = bestMatch(shopeeItems, product.name, shopeeOriginal, catMin);
      // Lazada: match against BOTH English and Thai name
      const lazadaMatch =
        bestMatch(lazadaItems, product.name, lazadaOriginal, catMin) ||
        bestMatch(lazadaItems, product.nameTh || product.name, lazadaOriginal, catMin);
      const bnnMatch = bestMatch(bnnItems, product.name, bnnOriginal, catMin);
      // Power Buy: try product name first; fall back to searchKeyword (handles Thai-titled
      // listings that omit the English brand, e.g. "WH-1000XM6 หูฟังไร้สาย" missing "Sony").
      const powerBuyMatch =
        bestMatch(powerBuyItems, product.name, powerBuyOriginal, catMin) ||
        (searchKw ? bestMatch(powerBuyItems, searchKw, powerBuyOriginal, catMin) : null);
      // Studio 7: also try Thai name (API may return Thai product names)
      const studio7Match =
        bestMatch(studio7Items, product.name, studio7Original, catMin) ||
        bestMatch(studio7Items, product.nameTh || product.name, studio7Original, catMin) ||
        (searchKw ? bestMatch(studio7Items, searchKw, studio7Original, catMin) : null);
      // JIB: try English and Thai names
      const jibMatch =
        bestMatch(jibItems, product.name, jibOriginal, catMin) ||
        bestMatch(jibItems, product.nameTh || product.name, jibOriginal, catMin) ||
        (searchKw ? bestMatch(jibItems, searchKw, jibOriginal, catMin) : null);
      // Samsung: English product names only
      const samsungMatch =
        bestMatch(samsungItems, product.name, samsungOriginal, catMin) ||
        (searchKw ? bestMatch(samsungItems, searchKw, samsungOriginal, catMin) : null);
      // Sony: try English and searchKeyword (model codes like "WH-1000XM6")
      const sonyMatch =
        bestMatch(sonyItems, product.name, sonyOriginal, catMin) ||
        bestMatch(sonyItems, product.nameTh || product.name, sonyOriginal, catMin) ||
        (searchKw ? bestMatch(sonyItems, searchKw, sonyOriginal, catMin) : null);
      // Dyson: English product names ("Dyson Airwrap" etc.)
      const dysonMatch =
        bestMatch(dysonItems, product.name, dysonOriginal, catMin) ||
        (searchKw ? bestMatch(dysonItems, searchKw, dysonOriginal, catMin) : null);
      // Central: try both names — may carry any product category
      const centralMatch =
        bestMatch(centralItems, product.name, centralOriginal, catMin) ||
        bestMatch(centralItems, product.nameTh || product.name, centralOriginal, catMin) ||
        (searchKw ? bestMatch(centralItems, searchKw, centralOriginal, catMin) : null);
      // Nike: English names only (shoe model names are always in English)
      const nikeMatch =
        bestMatch(nikeItems, product.name, nikeOriginal, catMin) ||
        (searchKw ? bestMatch(nikeItems, searchKw, nikeOriginal, catMin) : null);
      // Apple: English names + searchKeyword fallback
      const appleMatch =
        bestMatch(appleItems, product.name, appleOriginal, catMin) ||
        (searchKw ? bestMatch(appleItems, searchKw, appleOriginal, catMin) : null);
      // Watsons: beauty/health — try Thai name first (Watsons TH is mainly Thai-language)
      const watsonsMatch =
        bestMatch(watsonsItems, product.nameTh || product.name, watsonsOriginal, catMin) ||
        bestMatch(watsonsItems, product.name, watsonsOriginal, catMin) ||
        (searchKw ? bestMatch(watsonsItems, searchKw, watsonsOriginal, catMin) : null);

      // ── Layer 2: Post-match validation (price sanity + URL domain check) ─
      // validateMatch() re-checks the winner from bestMatch() against:
      //   • Category floor (catches accessories that share model keywords)
      //   • 15%–400% deviation from the known reference price
      //   • URL must belong to the expected platform domain
      // If validation fails the match is discarded (treated as "not found").
      const pn  = product.name;
      const cat = product.category;
      const lazadaFinal   = validateMatch(lazadaMatch,   "Lazada",        pn, cat, lazadaOriginal);
      const bnnFinal      = validateMatch(bnnMatch,       "Banana IT",    pn, cat, bnnOriginal);
      const powerBuyFinal = validateMatch(powerBuyMatch,  "Power Buy",    pn, cat, powerBuyOriginal);
      const studio7Final  = validateMatch(studio7Match,   "Studio 7",     pn, cat, studio7Original);
      const jibFinal      = validateMatch(jibMatch,       "JIB",          pn, cat, jibOriginal);
      const samsungFinal  = validateMatch(samsungMatch,   "Samsung Shop", pn, cat, samsungOriginal);
      const sonyFinal     = validateMatch(sonyMatch,      "Sony Store",   pn, cat, sonyOriginal);
      const dysonFinal    = validateMatch(dysonMatch,     "Dyson Store",        pn, cat, dysonOriginal);
      const centralFinal  = validateMatch(centralMatch,   "Central Online", pn, cat, centralOriginal);
      const nikeFinal     = validateMatch(nikeMatch,      "Nike.com",     pn, cat, nikeOriginal);
      const appleFinal    = validateMatch(appleMatch,     "Apple Store",  pn, cat, appleOriginal);
      const watsonsFinal  = validateMatch(watsonsMatch,   "Watsons",      pn, cat, watsonsOriginal);
      // Shopee: scraper disabled — no validation needed

      // ── Update prices array immutably ─────────────────────────────────
      //
      // Rules per platform:
      //   • Scraper ran AND found match   → update price/url/inStock, available = true
      //   • Scraper ran BUT no match      → preserve existing price (return base)
      //                                     Reason: in production (Railway), scrapers can be
      //                                     blocked by anti-bot. Marking unavailable destroys
      //                                     seeded prices. Preserve base so products stay visible.
      //   • Scraper skipped (no DB entry) → leave as-is (manually-curated entry)
      //   • Shopee (coming-soon stub)     → never mark unavailable (scraper disabled)
      const prices = product.prices.map((p) => {
        const base = typeof (p as any).toObject === "function"
          ? (p as any).toObject()
          : { ...p };

        // ── Shopee (scraper disabled / coming soon) ──────────────────────
        if (p.platform === "Shopee") {
          if (shopeeMatch) {
            result.shopee = { price: shopeeMatch.price, url: shopeeMatch.url };
            return { ...base, price: shopeeMatch.price, url: shopeeMatch.url,
                     inStock: shopeeMatch.inStock, available: true,
                     rating: shopeeMatch.rating || p.rating,
                     reviews: shopeeMatch.reviews || p.reviews };
          }
          return base; // stub — never mark unavailable
        }

        // ── Lazada (always scraped) ──────────────────────────────────────
        if (p.platform === "Lazada") {
          if (lazadaFinal) {
            result.lazada = { price: lazadaFinal.price, url: lazadaFinal.url };
            return { ...base, price: lazadaFinal.price, url: lazadaFinal.url,
                     inStock: lazadaFinal.inStock, available: true,
                     rating: lazadaFinal.rating || p.rating,
                     reviews: lazadaFinal.reviews || p.reviews,
                     coupon: lazadaFinal.coupon ?? undefined };
          }
          return base; // preserve seeded price when scraper finds no match
        }

        // ── Banana IT ────────────────────────────────────────────────────
        if (p.platform === "Banana IT") {
          if (bnnFinal) {
            result.bnn = { price: bnnFinal.price, url: bnnFinal.url };
            return { ...base, price: bnnFinal.price, url: bnnFinal.url,
                     inStock: bnnFinal.inStock, available: true };
          }
          if (hasBnnEntry) return base; // preserve seeded price when scraper finds no match
          return base; // skipped
        }

        // ── Power Buy ────────────────────────────────────────────────────
        if (p.platform === "Power Buy") {
          if (powerBuyFinal) {
            result.powerBuy = { price: powerBuyFinal.price, url: powerBuyFinal.url };
            return { ...base, price: powerBuyFinal.price, url: powerBuyFinal.url,
                     inStock: powerBuyFinal.inStock, available: true };
          }
          if (hasPowerBuyEntry) return base; // preserve seeded price when scraper finds no match
          return base;
        }

        // ── Studio 7 ─────────────────────────────────────────────────────
        if (p.platform === "Studio 7") {
          if (studio7Final) {
            result.studio7 = { price: studio7Final.price, url: studio7Final.url };
            return { ...base, price: studio7Final.price, url: studio7Final.url,
                     inStock: studio7Final.inStock, available: true };
          }
          if (hasStudio7Entry) return base; // preserve seeded price when scraper finds no match
          return base;
        }

        // ── JIB ──────────────────────────────────────────────────────────
        if (p.platform === "JIB") {
          if (jibFinal) {
            result.jib = { price: jibFinal.price, url: jibFinal.url };
            return { ...base, price: jibFinal.price, url: jibFinal.url,
                     inStock: jibFinal.inStock, available: true };
          }
          if (hasJIBEntry) return base; // preserve seeded price when scraper finds no match
          return base;
        }

        // ── Samsung Shop ─────────────────────────────────────────────────
        if (p.platform === "Samsung Shop") {
          if (samsungFinal) {
            result.samsung = { price: samsungFinal.price, url: samsungFinal.url };
            return { ...base, price: samsungFinal.price, url: samsungFinal.url,
                     inStock: samsungFinal.inStock, available: true };
          }
          if (hasSamsungEntry) return base; // preserve seeded price when scraper finds no match
          return base;
        }

        // ── Sony Store ───────────────────────────────────────────────────
        if (p.platform === "Sony Store") {
          if (sonyFinal) {
            result.sony = { price: sonyFinal.price, url: sonyFinal.url };
            return { ...base, price: sonyFinal.price, url: sonyFinal.url,
                     inStock: sonyFinal.inStock, available: true };
          }
          if (hasSonyEntry) return base; // preserve seeded price when scraper finds no match
          return base;
        }

        // ── Dyson ────────────────────────────────────────────────────────
        if (p.platform === "Dyson Store") {
          if (dysonFinal) {
            result.dyson = { price: dysonFinal.price, url: dysonFinal.url };
            return { ...base, price: dysonFinal.price, url: dysonFinal.url,
                     inStock: dysonFinal.inStock, available: true };
          }
          if (hasDysonEntry) return base; // preserve seeded price when scraper finds no match
          return base;
        }

        // ── Central Online ───────────────────────────────────────────────
        if (p.platform === "Central Online") {
          if (centralFinal) {
            result.central = { price: centralFinal.price, url: centralFinal.url };
            return { ...base, price: centralFinal.price, url: centralFinal.url,
                     inStock: centralFinal.inStock, available: true };
          }
          if (hasCentralEntry) return base; // preserve seeded price when scraper finds no match
          return base;
        }

        // ── Nike.com ─────────────────────────────────────────────────────
        if (p.platform === "Nike.com") {
          if (nikeFinal) {
            result.nike = { price: nikeFinal.price, url: nikeFinal.url };
            return { ...base, price: nikeFinal.price, url: nikeFinal.url,
                     inStock: nikeFinal.inStock, available: true };
          }
          if (hasNikeEntry) return base; // preserve seeded price when scraper finds no match
          return base;
        }

        // ── Apple Store ──────────────────────────────────────────────────
        if (p.platform === "Apple Store") {
          if (appleFinal) {
            result.apple = { price: appleFinal.price, url: appleFinal.url };
            return { ...base, price: appleFinal.price, url: appleFinal.url,
                     inStock: appleFinal.inStock, available: true };
          }
          if (hasAppleEntry) return base; // preserve seeded price when scraper finds no match
          return base;
        }

        // ── Watsons ───────────────────────────────────────────────────────
        if (p.platform === "Watsons") {
          if (watsonsFinal) {
            result.watsons = { price: watsonsFinal.price, url: watsonsFinal.url };
            return { ...base, price: watsonsFinal.price, url: watsonsFinal.url,
                     inStock: watsonsFinal.inStock, available: true,
                     coupon: watsonsFinal.coupon ?? undefined };
          }
          if (hasWatsonsEntry) return base; // preserve seeded price when scraper finds no match
          return base;
        }

        // ── Unknown / other platforms ────────────────────────────────────
        return base;
      });

      product.prices = prices as any;
      product.lastScraped = new Date();

      // ── Auto-update product image from scraped listings ───────────────
      // Priority: Lazada > Central > JIB > Samsung > Watsons (best API coverage).
      // Only fills in missing images — if product already has an image from the
      // brand CDN (set in seed or by admin), we keep it unless it's empty.
      // Validates that the URL is absolute (http/https) to skip CDN-relative paths.
      const isAbsoluteUrl = (s?: string) => !!s && /^https?:\/\//i.test(s);
      const scrapedImage =
        (isAbsoluteUrl(lazadaFinal?.image)   ? lazadaFinal!.image  : undefined) ??
        (isAbsoluteUrl(centralFinal?.image)  ? centralFinal!.image : undefined) ??
        (isAbsoluteUrl(jibFinal?.image)      ? jibFinal!.image     : undefined) ??
        (isAbsoluteUrl(samsungFinal?.image)  ? samsungFinal!.image : undefined) ??
        (isAbsoluteUrl(watsonsFinal?.image)  ? watsonsFinal!.image : undefined);

      if (scrapedImage && !product.image) {
        product.image = scrapedImage;
        console.log(`[scraper] 🖼  Auto-image "${product.name}": ${scrapedImage.slice(0, 80)}`);
      }

      // ── Price History Snapshot ────────────────────────────────────────
      // Record one snapshot per scrape run — active platforms only
      // (available !== false, not coming-soon like Shopee).
      const COMING_SOON = ["Shopee"];
      const activePlatformsForHistory = (prices as IPlatformPrice[]).filter(
        (p) => p.available !== false && !COMING_SOON.includes(p.platform)
      );
      if (activePlatformsForHistory.length > 0) {
        const snapshot = {
          date: new Date(),
          platforms: activePlatformsForHistory.map((p) => ({
            platform: p.platform,
            price: p.price,
          })),
          minPrice: Math.min(...activePlatformsForHistory.map((p) => p.price)),
        };
        // Keep rolling window of 180 snapshots (≈ 6 months if scraped daily)
        const history = [...(product.priceHistory || []), snapshot];
        product.priceHistory = history.slice(-180) as any;
      }

      // Use findByIdAndUpdate to avoid Mongoose VersionError (optimistic locking conflict
      // that occurs when the seed runs concurrently or just before the scraper saves).
      await Product.findByIdAndUpdate(
        product._id,
        {
          $set: {
            prices:       product.prices,
            lastScraped:  product.lastScraped,
            image:        product.image,
            priceHistory: product.priceHistory,
          },
        },
        { new: false }
      );

      // ── Check & trigger price alerts ─────────────────────────────────
      // After saving, find any pending alerts for this product whose
      // targetPrice >= current minPrice and trigger + email them.
      const newMinPrice = product.minPrice;
      if (newMinPrice > 0) {
        const pendingAlerts = await Alert.find({
          product: product._id,
          triggered: false,
          targetPrice: { $gte: newMinPrice },
        }).populate<{ user: { _id: string; name: string; email: string; lineNotifyToken?: string } }>(
          "user", "name email lineNotifyToken"
        );

        for (const alert of pendingAlerts) {
          alert.triggered = true;
          alert.triggeredAt = new Date();
          await alert.save();
          console.log(
            `🔔 Alert triggered: "${product.name}" ฿${newMinPrice} ≤ target ฿${alert.targetPrice} → ${alert.user?.email}`
          );

          const productUrl = `${process.env.APP_URL ?? "http://localhost:5173"}/product/${product._id}`;
          const productName = product.nameTh || product.name;

          // Send email (fire & forget)
          if (alert.user?.email) {
            sendPriceAlertEmail({
              to: alert.user.email,
              userName: alert.user.name ?? "ผู้ใช้",
              productName,
              productImage: product.image ?? "",
              productUrl,
              targetPrice: alert.targetPrice,
              currentPrice: newMinPrice,
            }).catch((e) => console.error("[mailer] unexpected error:", e));
          }

          // Send LINE Notify (fire & forget)
          if (alert.user?.lineNotifyToken) {
            sendLineNotify({
              token: alert.user.lineNotifyToken,
              message: buildPriceAlertMessage({
                productName,
                targetPrice: alert.targetPrice,
                currentPrice: newMinPrice,
                productUrl,
              }),
            }).catch((e) => console.error("[LINE] unexpected error:", e));
          }
        }
      }

      result.success = true;
      scraperProgress.done++;
      console.log(
        `✅ ${product.name} → ` +
        `Lazada ฿${lazadaFinal?.price ?? "N/A"}  ` +
        `BNN ฿${bnnFinal?.price ?? "N/A"}  ` +
        `PowerBuy ฿${powerBuyFinal?.price ?? "N/A"}  ` +
        `Studio7 ฿${studio7Final?.price ?? "N/A"}  ` +
        `JIB ฿${jibFinal?.price ?? "N/A"}  ` +
        `Samsung ฿${samsungFinal?.price ?? "N/A"}  ` +
        `Sony ฿${sonyFinal?.price ?? "N/A"}  ` +
        `Dyson ฿${dysonFinal?.price ?? "N/A"}  ` +
        `Central ฿${centralFinal?.price ?? "N/A"}  ` +
        `Nike ฿${nikeFinal?.price ?? "N/A"}  ` +
        `Apple ฿${appleFinal?.price ?? "N/A"}  ` +
        `Watsons ฿${watsonsFinal?.price ?? "N/A"}`
      );
    } catch (err) {
      result.error = (err as Error).message;
      console.error(`❌ Failed: ${product.name} —`, result.error);
      scraperProgress.done++;
      scraperProgress.failed++;
    }

    report.push(result);

    // Polite delay between products to avoid rate-limiting
    if (products.indexOf(product) < products.length - 1) {
      await new Promise((r) => setTimeout(r, 4_000));
    }
  }

  // ── Mark progress complete ─────────────────────────────────────────────────
  scraperProgress.isRunning      = false;
  scraperProgress.currentProduct = "";
  scraperProgress.finishedAt     = new Date().toISOString();

  return report;
}
