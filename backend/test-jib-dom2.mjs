/**
 * JIB DOM v2 — focus on .col-md-3 product cards.
 */
import { chromium } from "playwright";
const keyword = process.argv[2] || "iPhone 16";

const browser = await chromium.launch({ headless: false, args: ["--no-sandbox"], ignoreDefaultArgs: ["--enable-automation"] });
const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", locale: "th-TH", viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage();

const searchUrl = `https://www.jib.co.th/web/product/product_search/0?str_search=${encodeURIComponent(keyword)}&cate_id[]=`;
await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 35_000 }).catch(() =>
  page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 35_000 }));
await page.waitForTimeout(3000);

const info = await page.evaluate(() => {
  // Dump first 6 .col-md-3 div raw innerText + outerHTML snippet
  const cards = Array.from(document.querySelectorAll(".col-md-3"));
  const dumps = cards.slice(0, 8).map(card => {
    const text = card.innerText?.split("\n").map(s => s.trim()).filter(Boolean).slice(0, 6) ?? [];
    const link = card.querySelector("a")?.href?.slice(0, 100) ?? "";
    // Try every sub-element for price pattern
    const priceEl = Array.from(card.querySelectorAll("*")).find(el => {
      const t = el.textContent?.trim().replace(/,/g, "") ?? "";
      return /^\d{4,7}$/.test(t) && el.children.length === 0;
    });
    const priceText = priceEl?.textContent?.trim() ?? "";
    const priceCls  = priceEl?.className?.trim() ?? "";
    return { text, link, priceText, priceCls };
  });

  // Also dump 1st product card's full outerHTML (truncated)
  const firstCard = cards[0];
  const outerHtml = firstCard?.outerHTML?.slice(0, 800) ?? "";

  return { total: cards.length, dumps, outerHtml };
});

console.log(`\nTotal .col-md-3: ${info.total}`);
console.log("\n─── First card outerHTML ────────────────────────────────────");
console.log(info.outerHtml);

console.log("\n─── Cards dump ──────────────────────────────────────────────");
info.dumps.forEach((d, i) => {
  console.log(`\n[${i}] text: ${d.text.join(" | ")}`);
  console.log(`    link: ${d.link}`);
  console.log(`    price: "${d.priceText}"  cls: "${d.priceCls}"`);
});

await ctx.close();
await browser.close();
