/**
 * Central Online DOM + Algolia discovery — v2.
 * Dumps real class names + Algolia request details.
 *
 * Usage: node test-central-smoke.mjs "iPhone 16"
 */
import { chromium } from "playwright";

const keyword = process.argv[2] || "iPhone 16";

const browser = await chromium.launch({
  headless: false,
  args: ["--no-sandbox", "--disable-blink-features=AutomationControlled",
         "--window-size=1366,768", "--window-position=100,100", "--lang=th-TH"],
  ignoreDefaultArgs: ["--enable-automation"],
});
const ctx = await browser.newContext({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  locale: "th-TH", timezoneId: "Asia/Bangkok", viewport: { width: 1366, height: 768 },
});
const page = await ctx.newPage();

// ── Capture Algolia responses (search results) ────────────────────────────
let algoliaData = null;
page.on("response", async (resp) => {
  const url = resp.url();
  const ct  = resp.headers()["content-type"] ?? "";
  if (!ct.includes("json")) return;
  if (resp.status() !== 200) return;

  // Algolia search or query
  if (url.includes("algolia.net")) {
    try {
      const data = JSON.parse(await resp.text());
      // Algolia multi-query results: { results: [ { hits: [...] } ] }
      const hits = data?.results?.[0]?.hits ?? data?.hits ?? [];
      if (hits.length > 0) {
        console.log(`  🎯 Algolia: ${url.slice(0, 90)}`);
        console.log(`     hits[${hits.length}]`);
        console.log(`     ALL keys: ${Object.keys(hits[0]).join(", ")}`);
        console.log(`     Sample hit:\n${JSON.stringify(hits[0], null, 2).split("\n").slice(0, 40).join("\n")}`);
        if (!algoliaData) algoliaData = hits;
      } else {
        const findArrays = (obj, prefix = "", depth = 0) => {
          if (depth > 3 || !obj || typeof obj !== "object") return [];
          const r = [];
          for (const [k, v] of Object.entries(obj)) {
            const p = prefix ? `${prefix}.${k}` : k;
            if (Array.isArray(v) && v.length > 0) r.push({ p, len: v.length, sample: v[0] });
            else if (v && typeof v === "object" && !Array.isArray(v)) r.push(...findArrays(v, p, depth+1));
          }
          return r;
        };
        const arrs = findArrays(data);
        if (arrs.length > 0) {
          console.log(`  🔵 Algolia (no hits): ${url.slice(0, 90)}`);
          arrs.forEach(a => console.log(`     ${a.p}[${a.len}] — keys: ${Object.keys(a.sample??{}).slice(0,8).join(", ")}`));
        }
      }
    } catch {}
  }
});

// ── Navigate ──────────────────────────────────────────────────────────────
console.log("[1] Homepage warm-up...");
await page.goto("https://www.central.co.th/en", { waitUntil: "domcontentloaded", timeout: 30_000 });
await page.waitForTimeout(2_000);

const searchUrl = `https://www.central.co.th/en/search?q=${encodeURIComponent(keyword)}`;
console.log(`\n[2] Navigating to search: ${searchUrl}`);
await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 40_000 }).catch(() =>
  page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 40_000 })
);

// Extra wait + scroll for lazy loading
await page.waitForTimeout(3_000);
for (let y = 0; y <= 2000; y += 400) {
  await page.evaluate(y => window.scrollTo(0, y), y);
  await page.waitForTimeout(500);
}
await page.waitForTimeout(2_000);

// ── DOM deep inspection ───────────────────────────────────────────────────
console.log("\n[3] DOM deep inspection...");
const domReport = await page.evaluate(() => {
  // 1. Broad scan — count ALL elements that could be product cards
  const broad = {
    "article": document.querySelectorAll("article").length,
    "[data-product]": document.querySelectorAll("[data-product]").length,
    "[data-product-id]": document.querySelectorAll("[data-product-id]").length,
    "[data-sku]": document.querySelectorAll("[data-sku]").length,
    "[class*=tile]": document.querySelectorAll("[class*='tile']").length,
    "[class*=Tile]": document.querySelectorAll("[class*='Tile']").length,
    "[class*=card]": document.querySelectorAll("[class*='card']").length,
    "[class*=Card]": document.querySelectorAll("[class*='Card']").length,
    "[class*=product]": document.querySelectorAll("[class*='product']").length,
    "[class*=Product]": document.querySelectorAll("[class*='Product']").length,
    "[class*=item]": document.querySelectorAll("[class*='item']").length,
    "[class*=Item]": document.querySelectorAll("[class*='Item']").length,
    "a[href*='/p/']": document.querySelectorAll("a[href*='/p/']").length,
  };

  // 2. Find elements containing ฿ price text
  const allEls = document.querySelectorAll("*");
  const priceContainers = [];
  for (const el of allEls) {
    if (el.children.length === 0 && el.textContent && el.textContent.includes("฿")) {
      const cls = el.className || "(no class)";
      if (!priceContainers.includes(cls)) priceContainers.push(cls);
      if (priceContainers.length >= 8) break;
    }
  }

  // 3. Show first 5 product-like links
  const links = Array.from(document.querySelectorAll("a[href*='/p/'], a[href*='/en/p/']"))
    .slice(0, 5)
    .map(a => ({ href: a.href.slice(0, 80), text: a.textContent?.trim().slice(0, 60) }));

  // 4. Try to find any element with a price-like number near ฿
  const textWithPrice = [];
  for (const el of document.querySelectorAll("[class*='price'],[class*='Price'],[class*='cost'],[class*='Cost']")) {
    const t = el.textContent?.trim().slice(0, 60);
    if (t) textWithPrice.push(`${el.className.slice(0,40)}: ${t}`);
    if (textWithPrice.length >= 5) break;
  }

  return { broad, priceContainers, links, textWithPrice };
});

console.log("\n  Element counts:");
for (const [sel, n] of Object.entries(domReport.broad)) {
  if (n > 0) console.log(`    ${sel}: ${n}`);
}
console.log("\n  Classes containing ฿:");
domReport.priceContainers.forEach(c => console.log(`    ${c}`));
console.log("\n  Product links (a[href*='/p/']):");
domReport.links.forEach(l => console.log(`    ${l.href}\n      "${l.text}"`));
console.log("\n  Price elements:");
domReport.textWithPrice.forEach(t => console.log(`    ${t}`));

console.log("\n[4] Final URL:", page.url());
console.log("\n✅ Done");

await ctx.close();
await browser.close();
