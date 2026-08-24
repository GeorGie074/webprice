/**
 * JIB — deep DOM dump to find product name/price selectors.
 * Usage: node test-jib-dom.mjs "iPhone 16"
 */
import { chromium } from "playwright";
const keyword = process.argv[2] || "iPhone 16";

const browser = await chromium.launch({ headless: false, args: ["--no-sandbox"], ignoreDefaultArgs: ["--enable-automation"] });
const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36", locale: "th-TH", viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage();

const searchUrl = `https://www.jib.co.th/web/product/product_search/0?str_search=${encodeURIComponent(keyword)}&cate_id[]=`;
console.log(`[JIB] ${searchUrl}`);
await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 35_000 }).catch(() =>
  page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 35_000 }));
await page.waitForTimeout(2000);

const info = await page.evaluate(() => {
  // Try lm_18_unit cards
  const units = Array.from(document.querySelectorAll(".lm_18_unit,.col-md-3,.pro_list_box"));

  // Get all unique class names in the first lm_18_unit
  const firstUnit = document.querySelector(".lm_18_unit");
  const unitClasses = firstUnit
    ? Array.from(firstUnit.querySelectorAll("*")).flatMap(el =>
        (el.className?.toString()?.split(" ") ?? []).filter(c => c.length > 2)
      ).filter((c,i,a) => a.indexOf(c)===i)
    : [];

  // Sample first 6 units
  const samples = units.slice(0, 6).map(card => {
    const allText = card.innerText?.split("\n").map(s => s.trim()).filter(Boolean) ?? [];
    const link = card.querySelector("a")?.href ?? "";
    const img = card.querySelector("img")?.src ?? "";
    return { allText: allText.slice(0, 8), link: link.slice(0, 100), img: img.slice(0, 80) };
  });

  // Find price elements (containing digits 4-6 digits after comma removal)
  const priceEls = [];
  for (const el of document.querySelectorAll("*")) {
    if (el.children.length > 0) continue;
    const t = el.textContent?.trim().replace(/,/g,"") ?? "";
    if (/^\d{4,7}$/.test(t)) {
      priceEls.push({ cls: el.className?.slice(0,50), val: el.textContent?.trim() });
      if (priceEls.length >= 8) break;
    }
  }

  return { unitCount: units.length, unitClasses, samples, priceEls };
});

console.log(`\nTotal .lm_18_unit cards: ${info.unitCount}`);
console.log(`\nClasses inside first unit: ${info.unitClasses.join(", ")}`);
console.log("\n── Sample cards ──────────────────────────────────────────");
info.samples.forEach((s, i) => {
  console.log(`\n[${i}] Text lines: ${s.allText.join(" | ")}`);
  console.log(`    Link: ${s.link}`);
});
console.log("\n── Price elements ──────────────────────────────────────────");
info.priceEls.forEach(p => console.log(`  cls="${p.cls}"  val="${p.val}"`));

await ctx.close();
await browser.close();
