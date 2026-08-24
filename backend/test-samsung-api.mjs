/**
 * Samsung TH — deep probe of getSimpleProductsInfo + search API.
 * Usage: node test-samsung-api.mjs
 */
import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: false,
  args: ["--no-sandbox","--disable-blink-features=AutomationControlled",
         "--window-size=1366,768","--window-position=100,100"],
  ignoreDefaultArgs: ["--enable-automation"],
});
const ctx = await browser.newContext({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  locale: "th-TH", timezoneId: "Asia/Bangkok", viewport: {width:1366,height:768},
});
const page = await ctx.newPage();

// Capture Samsung shop APIs
page.on("response", async (resp) => {
  const url = resp.url();
  if (resp.status() !== 200) return;
  if (!url.includes("samsung.com") && !url.includes("searchapi.samsung")) return;
  const ct = resp.headers()["content-type"] ?? "";
  if (!ct.includes("json")) return;
  if (url.includes("analytics") || url.includes("gtm") || url.includes("smetrics")) return;

  try {
    const data = JSON.parse(await resp.text());

    // Samsung shop price API
    if (url.includes("getSimpleProductsInfo")) {
      console.log(`\n🎯 getSimpleProductsInfo: ${url.slice(0,120)}`);
      const products = data?.productDatas ?? [];
      console.log(`   Count: ${products.length}`);
      if (products[0]) {
        console.log(`   Keys: ${Object.keys(products[0]).join(", ")}`);
        products.slice(0, 4).forEach((p, i) => {
          console.log(`\n   [${i}] code:            ${p.productCode}`);
          console.log(`        price:           ${p.price}`);
          console.log(`        priceFormatted:  ${p.priceFormatted}`);
          console.log(`        salesStatus:     ${p.salesStatus}`);
          console.log(`        stock:           ${p.stockLevelStatus}`);
        });
      }
    }

    // Samsung search API
    if (url.includes("searchapi.samsung.com") && url.includes("model/list")) {
      console.log(`\n🔍 Samsung Search API: ${url.slice(0,120)}`);
      const models = data?.response?.resultData?.productList ?? [];
      console.log(`   Models: ${models.length}`);
      if (models[0]) {
        console.log(`   Keys: ${Object.keys(models[0]).join(", ")}`);
        models.slice(0, 3).forEach((m, i) => {
          console.log(`   [${i}] ${m.fmyEngName ?? m.fmyMarketingName}`);
        });
      }
    }
  } catch {}
});

// ── Navigate to S25 product page ─────────────────────────────────────────────
console.log("[1] Loading Samsung Galaxy S25 page...");
await page.goto("https://www.samsung.com/th/smartphones/galaxy-s25/", {
  waitUntil: "domcontentloaded", timeout: 35_000,
});
await page.waitForTimeout(4000);

// ── Inspect DOM for price on the product page ────────────────────────────────
const domInfo = await page.evaluate(() => {
  // Look for [data-price] and [data-sku]
  const dataPriceEls = Array.from(document.querySelectorAll("[data-price]"))
    .slice(0, 5).map(el => ({
      tag: el.tagName,
      dataPrice: el.getAttribute("data-price"),
      dataSku: el.getAttribute("data-sku") ?? el.getAttribute("data-product-code"),
      text: el.textContent?.trim().slice(0, 60),
      classes: el.className?.slice(0, 60),
    }));

  // JSON-LD extraction
  const jsonLds = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .map(s => { try { return JSON.parse(s.textContent); } catch { return null; } })
    .filter(Boolean);
  const priceJsonLd = jsonLds
    .filter(j => j.offers || j.price || j["@type"] === "Product")
    .slice(0, 3);

  // Price text scan
  const priceTexts = [];
  for (const el of document.querySelectorAll("*")) {
    if (el.children.length > 0) continue;
    const t = el.textContent?.trim() ?? "";
    if (t.includes("฿") && t.length < 25) {
      priceTexts.push({ text: t, class: el.className?.slice(0, 50) });
      if (priceTexts.length >= 6) break;
    }
  }

  return { dataPriceEls, priceTexts, jsonLdCount: jsonLds.length, priceJsonLd };
});

console.log("\n📌 [data-price] elements:");
domInfo.dataPriceEls.forEach((el, i) =>
  console.log(`  [${i}] data-price="${el.dataPrice}" sku="${el.dataSku}" text="${el.text}"`));

console.log("\n💰 Price text elements (contain ฿):");
domInfo.priceTexts.forEach(p => console.log(`  "${p.text}"  cls: ${p.class}`));

console.log(`\n📋 JSON-LD blocks: ${domInfo.jsonLdCount}`);
if (domInfo.priceJsonLd.length) {
  domInfo.priceJsonLd.forEach((j, i) => {
    console.log(`  [${i}] type: ${j["@type"]}`);
    const price = j.offers?.price ?? j.price ?? j.offers?.lowPrice;
    console.log(`      price: ${price}`);
    const name = j.name;
    console.log(`      name: ${name}`);
  });
}

// ── Also try Samsung search API directly ─────────────────────────────────────
console.log("\n[2] Checking Samsung search API for 'Galaxy S25'...");
await page.goto(
  "https://www.samsung.com/th/search/?searchvalue=Galaxy+S25",
  { waitUntil: "domcontentloaded", timeout: 30_000 }
);
await page.waitForTimeout(3000);

console.log(`\nFinal URL: ${page.url()}`);
await ctx.close();
await browser.close();
