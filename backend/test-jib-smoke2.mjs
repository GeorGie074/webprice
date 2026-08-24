/**
 * JIB deep DOM probe — check product cards and price structure.
 * Usage: node test-jib-smoke2.mjs "iPhone 16"
 */
import { chromium } from "playwright";
const keyword = process.argv[2] || "iPhone 16";

const browser = await chromium.launch({
  headless: false,
  args: ["--no-sandbox", "--disable-blink-features=AutomationControlled",
         "--window-size=1366,768", "--window-position=100,100"],
  ignoreDefaultArgs: ["--enable-automation"],
});
const ctx = await browser.newContext({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  locale: "th-TH", timezoneId: "Asia/Bangkok", viewport: { width: 1366, height: 768 },
});
const page = await ctx.newPage();

// Capture ALL JSON API responses
const apiHits = [];
page.on("response", async (resp) => {
  const url = resp.url();
  const ct  = resp.headers()["content-type"] ?? "";
  if (resp.status() !== 200 || !ct.includes("json")) return;
  if (url.includes("gtm") || url.includes("analytics") || url.includes("google")) return;
  try {
    const text = await resp.text();
    const data = JSON.parse(text);
    apiHits.push({ url: url.slice(0, 120), data });
  } catch {}
});

const searchUrl = `https://www.jib.co.th/web/search?cate_id=0&ctype=0&keyword=${encodeURIComponent(keyword)}`;
console.log(`\n[JIB] Navigating: ${searchUrl}`);
await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 35_000 }).catch(() =>
  page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 35_000 }));

await page.waitForTimeout(3000);
for (let y = 0; y <= 2000; y += 400) {
  await page.evaluate(y => window.scrollTo(0, y), y).catch(() => {});
  await page.waitForTimeout(400);
}
await page.waitForTimeout(2000);

// Print captured API responses
if (apiHits.length > 0) {
  console.log("\n📡 Captured API responses:");
  for (const h of apiHits.slice(0, 5)) {
    console.log(`  ${h.url}`);
    const keys = typeof h.data === "object" ? Object.keys(h.data).slice(0, 5).join(", ") : "scalar";
    console.log(`    keys: ${keys}`);
  }
} else {
  console.log("\n📡 No JSON API responses captured");
}

// Deep DOM inspection
const info = await page.evaluate(() => {
  // Try many product card patterns
  const trySelectors = [
    ".col-md-3",".col-sm-6",".col-xs-6",
    "[class*='product']","[class*='item-box']","[class*='product-item']",
    ".product-list li",".product-box","[class*='ProBox']",
    "li.col","li[class*='product']",
  ];
  const found = {};
  for (const sel of trySelectors) {
    const n = document.querySelectorAll(sel).length;
    if (n > 0) found[sel] = n;
  }

  // Try to get product names and prices from first visible cards
  const cards = document.querySelectorAll(".col-md-3,.col-sm-6,li[class*='col']");
  const samples = Array.from(cards).slice(0, 6).map(card => {
    const name  = card.querySelector("h4,h3,[class*='name'],[class*='Name'],p.name")?.textContent?.trim().slice(0, 60) ?? "";
    const price = card.querySelector("[class*='price'],[class*='Price']")?.textContent?.trim().slice(0, 30) ?? "";
    const link  = card.querySelector("a")?.href?.slice(0, 80) ?? "";
    return { name, price, link };
  }).filter(s => s.name || s.price);

  // Classes containing price patterns
  const priceClasses = [];
  for (const el of document.querySelectorAll("*")) {
    if (el.children.length > 0) continue;
    const t = el.textContent?.trim() ?? "";
    if (/^\d{3,6}(\.\d{2})?$/.test(t.replace(/,/g,""))) {
      const cls = (el.className || el.tagName).slice(0, 60);
      if (!priceClasses.includes(cls)) priceClasses.push(cls);
      if (priceClasses.length >= 6) break;
    }
  }

  // Page source snippet (first product area)
  const body = document.body.innerHTML;
  const prIdx = body.indexOf("฿");
  const prSnippet = prIdx >= 0 ? body.slice(Math.max(0, prIdx-100), prIdx+150).replace(/<[^>]+>/g," ").trim() : "";

  return { found, samples, priceClasses, prSnippet, title: document.title.slice(0, 60) };
});

console.log(`\nPage title: ${info.title}`);
console.log(`\nDOM counts:`, info.found);
console.log(`\nSample cards:`);
info.samples.forEach((s,i) => console.log(`  [${i}] "${s.name}" | "${s.price}" | ${s.link}`));
console.log(`\nPrice-like element classes:`, info.priceClasses);
if (info.prSnippet) console.log(`\n฿ context: ...${info.prSnippet}...`);
console.log(`\nFinal URL: ${page.url()}`);

await ctx.close();
await browser.close();
