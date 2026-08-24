/**
 * JIB DOM v3 — find main content area product rows.
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
  // Look for col-md-9 or col-md-8 (main content area)
  const mainArea = document.querySelector(".col-md-9,.col-md-8,.main-content,#content,main");
  const mainHTML = mainArea?.innerHTML?.slice(0, 600) ?? "(not found)";

  // Scan for elements that contain product-like links
  const productLinks = Array.from(document.querySelectorAll("a[href*='/product_detail/'],a[href*='/product/']"))
    .slice(0, 12).map(a => ({
      href: a.href.slice(0, 100),
      text: a.textContent?.trim().slice(0, 60),
      cls: a.className?.slice(0, 40),
      parentCls: a.parentElement?.className?.slice(0, 50),
    }));

  // Look for elements with price-like text (5-digit numbers) near product links
  const priceNodes = [];
  for (const el of document.querySelectorAll("*")) {
    if (el.children.length > 0) continue;
    const t = el.textContent?.trim() ?? "";
    const clean = t.replace(/,/g,"");
    if (/^\d{4,7}$/.test(clean)) {
      // Walk up to find a product link nearby
      let p = el.parentElement;
      let productLink = null;
      for (let i = 0; i < 5 && p; i++, p = p.parentElement) {
        productLink = p.querySelector("a[href*='/product_detail/'],a[href*='/product/']");
        if (productLink) break;
      }
      if (productLink) {
        priceNodes.push({
          priceCls: el.className?.slice(0, 60),
          priceVal: t,
          productName: productLink.textContent?.trim().slice(0, 60),
          productHref: productLink.href.slice(0, 80),
        });
        if (priceNodes.length >= 5) break;
      }
    }
  }

  // Check for .col-sm-6 cards (common product card in JIB)
  const sm6 = Array.from(document.querySelectorAll(".col-sm-6"))
    .slice(0, 4).map(el => el.innerText?.split("\n").filter(s=>s.trim()).slice(0,5).join(" | "));

  return { mainHTML, productLinks, priceNodes, sm6Count: document.querySelectorAll(".col-sm-6").length, sm6 };
});

console.log(`\n.col-sm-6 count: ${info.sm6Count}`);
console.log("Main area HTML:", info.mainHTML.slice(0, 400));
console.log("\nProduct links found:");
info.productLinks.forEach((l, i) => console.log(`  [${i}] ${l.href}\n      text="${l.text}"  parentCls="${l.parentCls}"`));
console.log("\nPrice nodes with nearby product links:");
info.priceNodes.forEach(p => console.log(`  priceCls="${p.priceCls}" val="${p.priceVal}"\n    product: "${p.productName}"\n    href: ${p.productHref}`));
console.log("\n.col-sm-6 samples:", info.sm6);

await ctx.close();
await browser.close();
