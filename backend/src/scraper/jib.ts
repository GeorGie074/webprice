import { chromium } from "playwright";
import type { ScrapedItem } from "./shopee.js";

/**
 * Scrape JIB Computer (jib.co.th) — major Thai IT retailer.
 *
 * Strategy:
 *  1. Navigate to search URL: /web/product/product_search/0?str_search={keyword}&cate_id[]=
 *  2. Parse PHP-rendered product cards (server-side HTML, no API interception needed).
 *  3. Product card selector: .col-md-3.col-sm-4.col-xs-6
 *     - Name:  .reladiv a (first anchor link text)
 *     - Price: .boxprice .col-sm-6.text-right — lines: "24,000.- -2%" / "23,590.-" / "ลดทันที 410.-"
 *              → skip "ลดทันที" line, take smallest remaining number (= current price)
 *     - URL:   .reladiv a (first anchor link href)
 *
 * Carries: laptops, desktops, phones, tablets, headphones, peripherals
 */
export async function scrapeJIB(keyword: string): Promise<ScrapedItem[]> {
  const browser = await chromium.launch({
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

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    viewport: { width: 1366, height: 768 },
  });

  const page    = await context.newPage();
  const results: ScrapedItem[] = [];

  try {
    const searchUrl = `https://www.jib.co.th/web/product/product_search/0?str_search=${encodeURIComponent(keyword)}&cate_id[]=`;

    console.log(`[JIB] Searching "${keyword}"...`);
    await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 35_000 })
      .catch(() => page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 35_000 }));
    await page.waitForTimeout(1_500);

    const items = await page.evaluate(() => {
      // Each product card: .col-md-3.col-sm-4.col-xs-6
      const cards = Array.from(
        document.querySelectorAll(".col-md-3.col-sm-4.col-xs-6")
      );

      return cards.slice(0, 15).map((card) => {
        // ── Name + URL ─────────────────────────────────────────────────
        const reladiv = card.querySelector(".reladiv");
        // First anchor that isn't "ซื้อเลย" / "เพิ่มลงตะกร้า"
        const links = Array.from(reladiv?.querySelectorAll("a") ?? []);
        const productLink = links.find((a) => {
          const t = a.textContent?.trim() ?? "";
          return t.length > 5 && !["ซื้อเลย","เพิ่มลงตะกร้า","เปรียบเทียบ"].includes(t);
        }) as HTMLAnchorElement | undefined;

        const name = productLink?.textContent?.trim().replace(/\s+/g, " ") ?? "";
        const url  = productLink?.href ?? "";

        // ── Image ───────────────────────────────────────────────────────
        // JIB cards have a product image above the reladiv text block
        const imgEl = card.querySelector("img") as HTMLImageElement | null;
        const image = imgEl?.src || imgEl?.getAttribute("data-src") || "";

        // ── Price ───────────────────────────────────────────────────────
        // Format: "24,000.-  -2%\n23,590.-\nลดทันที   410.-"
        //   Line 1: original price + discount %  (e.g. "24,000.-  -2%")
        //   Line 2: current selling price         (e.g. "23,590.-")  ← we want this
        //   Line 3: discount amount               (e.g. "ลดทันที 410.-") ← skip
        // Strategy: exclude "ลดทันที" lines, then take the smallest remaining number
        const priceBox = card.querySelector(".boxprice .text-right,.col-sm-6.text-right");
        const priceText = priceBox?.textContent ?? "";
        const priceLines = priceText
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !l.includes("ลดทันที"));
        const nums = (priceLines.join(" ").match(/[\d,]+(?:\.\d+)?/g) ?? [])
          .map((n) => parseFloat(n.replace(/,/g, "")))
          .filter((n) => n >= 100 && n <= 10_000_000); // sanity: 100–10M baht
        // Current price = smallest number after excluding discount-amount lines
        const price = nums.length > 0 ? Math.round(Math.min(...nums)) : 0;

        // ── In-stock ────────────────────────────────────────────────────
        const outOfStock = card.textContent?.includes("สินค้าหมด") ?? false;

        return { name, price, url, inStock: !outOfStock, image };
      });
    }).catch(() => [] as { name: string; price: number; url: string; inStock: boolean; image: string }[]);

    for (const item of items) {
      if (item.name && item.price > 0) {
        const image = item.image && item.image.startsWith("http") ? item.image : undefined;
        results.push({
          name:    item.name,
          price:   item.price,
          url:     item.url || searchUrl,
          inStock: item.inStock,
          rating:  0,
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
    console.error(`[JIB] Error "${keyword}":`, (err as Error).message);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    console.log("[JIB] Browser closed");
  }

  console.log(`[JIB] "${keyword}" → ${results.length} results`);
  return results;
}
