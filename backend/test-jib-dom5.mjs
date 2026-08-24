/**
 * JIB DOM v5 — dump parent row of price cards to find full product structure.
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
  // Find a price card (.col-sm-6.col-xs-6.text-right)
  const priceCard = document.querySelector(".col-md-6.col-sm-6.col-xs-6.pad-0.text-right");
  if (!priceCard) return { error: "No price card found" };

  // Walk up to find a meaningful parent (the product container)
  let parent = priceCard.parentElement;
  const parents = [];
  for (let i = 0; i < 8 && parent; i++) {
    parents.push({
      depth: i,
      tag: parent.tagName,
      cls: parent.className?.slice(0, 70),
      textSnippet: parent.innerText?.trim().slice(0, 100),
    });
    parent = parent.parentElement;
  }

  // Dump outerHTML of grandparent (2 levels up) and great-grandparent
  const gp = priceCard.parentElement?.parentElement;
  const ggp = gp?.parentElement;
  return {
    parents,
    gpHTML: gp?.outerHTML?.slice(0, 1200) ?? "",
    ggpClasses: ggp?.className,
    ggpHTMLHead: ggp?.outerHTML?.slice(0, 300) ?? "",
  };
});

if (info.error) { console.log("Error:", info.error); }
else {
  console.log("\nParent chain from price card:");
  info.parents.forEach(p => console.log(`  [${p.depth}] ${p.tag}.${p.cls?.split(" ").slice(0,3).join(".")} → "${p.textSnippet?.slice(0,60)}"`));
  console.log("\n── Grandparent HTML ──────────────────────────────────────────");
  console.log(info.gpHTML);
  console.log("\n── Great-grandparent classes ─────────────────────────────────");
  console.log(info.ggpClasses);
  console.log(info.ggpHTMLHead);
}

await ctx.close();
await browser.close();
