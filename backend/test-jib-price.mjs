/**
 * JIB — dump raw price box HTML to understand price format.
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
  const cards = Array.from(document.querySelectorAll(".col-md-3.col-sm-4.col-xs-6"));
  return cards.slice(0, 5).map(card => {
    const name = card.querySelector(".reladiv a")?.textContent?.trim().slice(0,60) ?? "";
    // Get full boxprice HTML
    const boxprice = card.querySelector(".boxprice");
    const boxHTML = boxprice?.innerHTML ?? "";
    const boxText = boxprice?.innerText?.split("\n").map(s=>s.trim()).filter(Boolean) ?? [];
    // Also get the text-right price section specifically
    const priceRight = card.querySelector(".col-md-6.col-sm-6.col-xs-6.pad-0.text-right,.text-right.pad-0");
    const priceHTML = priceRight?.innerHTML?.slice(0, 400) ?? "";
    const priceText = priceRight?.innerText?.split("\n").map(s=>s.trim()).filter(Boolean) ?? [];
    return { name, boxHTML: boxHTML.slice(0, 600), boxText, priceHTML, priceText };
  });
});

info.forEach((d, i) => {
  console.log(`\n═══ Card [${i}]: "${d.name}" ═══`);
  console.log("Box text:", d.boxText);
  console.log("Price-right text:", d.priceText);
  console.log("Box HTML:\n" + d.boxHTML.slice(0, 500));
});

await ctx.close();
await browser.close();
