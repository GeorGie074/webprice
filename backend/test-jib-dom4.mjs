/**
 * JIB DOM v4 — deep dump of .col-sm-6 product cards.
 */
import { chromium } from "playwright";
const keyword = process.argv[2] || "iPhone 16";

const browser = await chromium.launch({ headless: false, args: ["--no-sandbox"], ignoreDefaultArgs: ["--enable-automation"] });
const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", locale: "th-TH", viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage();

const searchUrl = `https://www.jib.co.th/web/product/product_search/0?str_search=${encodeURIComponent(keyword)}&cate_id[]=`;
await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 35_000 }).catch(() =>
  page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 35_000 }));
await page.waitForTimeout(2000);

const info = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll(".col-sm-6"));
  // Dump first 8 card's full text + outerHTML head
  const dumps = cards.slice(0, 8).map((card, i) => {
    const html = card.outerHTML.slice(0, 500);
    const text = card.innerText?.split("\n").map(s=>s.trim()).filter(Boolean).slice(0,10) ?? [];
    const links = Array.from(card.querySelectorAll("a")).map(a => a.href.slice(0, 100));
    return { i, text, links, html };
  });
  return dumps;
});

info.forEach(d => {
  console.log(`\n[${d.i}] Text: ${d.text.join(" | ")}`);
  console.log(`    Links: ${d.links.slice(0,2).join(", ")}`);
  console.log(`    HTML: ${d.html.slice(0, 300)}`);
  console.log("─".repeat(70));
});

await ctx.close();
await browser.close();
