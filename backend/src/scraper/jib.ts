import { load } from "cheerio";
import { createContext } from "./browser.js";
import type { ScrapedItem } from "./shopee.js";

/**
 * Scrape JIB Computer (jib.co.th) — major Thai IT retailer.
 *
 * Two code paths:
 *  A) ScraperAPI API mode (when SCRAPERAPI_KEY is set — used on Railway):
 *     GET http://api.scraperapi.com/?api_key=KEY&url=ENCODED_JIB_URL
 *     → Returns server-rendered HTML → parse with Cheerio.
 *     Port 80 — always reachable from Railway.
 *
 *  B) Playwright mode (local dev, no SCRAPERAPI_KEY):
 *     Launch headed Chrome, navigate, evaluate DOM.
 *
 * Product card selector: .col-md-3.col-sm-4.col-xs-6
 *   Name:  .reladiv a (first anchor whose text is the product name)
 *   Price: .boxprice .text-right — take smallest number, excluding "ลดทันที" lines
 *   URL:   .reladiv a href
 */

// ─── Path A: ScraperAPI fetch + Cheerio ───────────────────────────────────────
async function scrapeJIBViaScraperAPI(
  keyword: string,
  apiKey: string
): Promise<ScrapedItem[]> {
  const jibUrl = `https://www.jib.co.th/web/product/product_search/0?str_search=${encodeURIComponent(keyword)}&cate_id[]=`;
  const scraperUrl =
    `http://api.scraperapi.com/?api_key=${apiKey}` +
    `&url=${encodeURIComponent(jibUrl)}&country_code=th`;

  console.log(`[JIB] Fetching via ScraperAPI...`);
  const res = await fetch(scraperUrl, {
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`ScraperAPI HTTP ${res.status}`);
  const html = await res.text();

  const $ = load(html);
  const results: ScrapedItem[] = [];
  const SKIP = ["ซื้อเลย", "เพิ่มลงตะกร้า", "เปรียบเทียบ"];

  $(".col-md-3.col-sm-4.col-xs-6")
    .slice(0, 15)
    .each((_, card) => {
      // ── Name + URL ──────────────────────────────────────────────────────────
      const productLink = $(card)
        .find(".reladiv a")
        .toArray()
        .find((a) => {
          const t = $(a).text().trim();
          return t.length > 5 && !SKIP.includes(t);
        });

      const name = productLink
        ? $(productLink).text().trim().replace(/\s+/g, " ")
        : "";
      const rawHref = productLink ? $(productLink).attr("href") ?? "" : "";
      const url = rawHref
        ? rawHref.startsWith("http")
          ? rawHref
          : `https://www.jib.co.th${rawHref.startsWith("/") ? "" : "/"}${rawHref}`
        : "";

      // ── Image ───────────────────────────────────────────────────────────────
      const imgEl = $(card).find("img").first();
      const imgSrc = imgEl.attr("src") || imgEl.attr("data-src") || "";
      const image = imgSrc.startsWith("http") ? imgSrc : undefined;

      // ── Price ───────────────────────────────────────────────────────────────
      const priceBox = $(card)
        .find(".boxprice .text-right, .col-sm-6.text-right")
        .first();
      const priceText = priceBox.text();
      const priceLines = priceText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.includes("ลดทันที"));
      const nums = (priceLines.join(" ").match(/[\d,]+(?:\.\d+)?/g) ?? [])
        .map((n) => parseFloat(n.replace(/,/g, "")))
        .filter((n) => n >= 100 && n <= 10_000_000);
      const price = nums.length > 0 ? Math.round(Math.min(...nums)) : 0;

      // ── In-stock ────────────────────────────────────────────────────────────
      const inStock = !$(card).text().includes("สินค้าหมด");

      if (name && price > 0) {
        results.push({
          name,
          price,
          url: url || jibUrl,
          inStock,
          rating: 0,
          reviews: 0,
          image,
        });
      }
    });

  return results;
}

// ─── Path B: Playwright (local dev) ───────────────────────────────────────────
async function scrapeJIBViaPlaywright(keyword: string): Promise<ScrapedItem[]> {
  const context = await createContext(false);
  const page = await context.newPage();
  const results: ScrapedItem[] = [];
  const searchUrl = `https://www.jib.co.th/web/product/product_search/0?str_search=${encodeURIComponent(keyword)}&cate_id[]=`;

  try {
    console.log(`[JIB] Searching "${keyword}" via Playwright...`);
    await page
      .goto(searchUrl, { waitUntil: "networkidle", timeout: 35_000 })
      .catch(() =>
        page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 35_000 })
      );
    await page.waitForTimeout(1_500);

    const items = await page
      .evaluate(() => {
        const cards = Array.from(
          document.querySelectorAll(".col-md-3.col-sm-4.col-xs-6")
        );
        return cards.slice(0, 15).map((card) => {
          const reladiv = card.querySelector(".reladiv");
          const links = Array.from(reladiv?.querySelectorAll("a") ?? []);
          const productLink = links.find((a) => {
            const t = a.textContent?.trim() ?? "";
            return (
              t.length > 5 &&
              !["ซื้อเลย", "เพิ่มลงตะกร้า", "เปรียบเทียบ"].includes(t)
            );
          }) as HTMLAnchorElement | undefined;
          const name =
            productLink?.textContent?.trim().replace(/\s+/g, " ") ?? "";
          const url = productLink?.href ?? "";
          const imgEl = card.querySelector("img") as HTMLImageElement | null;
          const image =
            imgEl?.src || imgEl?.getAttribute("data-src") || "";
          const priceBox = card.querySelector(
            ".boxprice .text-right,.col-sm-6.text-right"
          );
          const priceText = priceBox?.textContent ?? "";
          const priceLines = priceText
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && !l.includes("ลดทันที"));
          const nums = (priceLines.join(" ").match(/[\d,]+(?:\.\d+)?/g) ?? [])
            .map((n) => parseFloat(n.replace(/,/g, "")))
            .filter((n) => n >= 100 && n <= 10_000_000);
          const price =
            nums.length > 0 ? Math.round(Math.min(...nums)) : 0;
          const outOfStock = card.textContent?.includes("สินค้าหมด") ?? false;
          return { name, price, url, inStock: !outOfStock, image };
        });
      })
      .catch(
        () =>
          [] as {
            name: string;
            price: number;
            url: string;
            inStock: boolean;
            image: string;
          }[]
      );

    for (const item of items) {
      if (item.name && item.price > 0) {
        const image =
          item.image && item.image.startsWith("http") ? item.image : undefined;
        results.push({
          name: item.name,
          price: item.price,
          url: item.url || searchUrl,
          inStock: item.inStock,
          rating: 0,
          reviews: 0,
          image,
        });
      }
    }

    if (results.length === 0) {
      const title = await page.title().catch(() => "?");
      console.log(`[JIB] No results — page: "${title.slice(0, 60)}"`);
    }
  } catch (err) {
    console.error(`[JIB] Playwright error "${keyword}":`, (err as Error).message);
  } finally {
    await context.close().catch(() => {});
  }

  return results;
}

// ─── Entry point ───────────────────────────────────────────────────────────────
export async function scrapeJIB(keyword: string): Promise<ScrapedItem[]> {
  const apiKey = process.env.SCRAPERAPI_KEY;

  if (apiKey) {
    try {
      const results = await scrapeJIBViaScraperAPI(keyword, apiKey);
      console.log(
        `[JIB] "${keyword}" → ${results.length} results (ScraperAPI)`
      );
      return results;
    } catch (err) {
      console.error(
        `[JIB] ScraperAPI failed: ${(err as Error).message} — falling back to Playwright`
      );
    }
  }

  const results = await scrapeJIBViaPlaywright(keyword);
  console.log(`[JIB] "${keyword}" → ${results.length} results (Playwright)`);
  return results;
}
