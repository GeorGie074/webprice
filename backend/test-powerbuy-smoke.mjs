/**
 * Power Buy API discovery smoke test — v2.
 * Uses real search box interaction instead of URL navigation.
 *
 * Usage: node test-powerbuy-smoke.mjs "iPhone 16"
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

// ── Log JSON API responses that contain product arrays ────────────────────
page.on("response", async (resp) => {
  const url = resp.url();
  const ct  = resp.headers()["content-type"] ?? "";
  if (resp.status() !== 200) return;
  if (!ct.includes("json")) return;
  if (url.includes("/_next/static") || url.endsWith(".js") || url.includes("gtm")
      || url.includes("analytics") || url.includes("qualtrics") || url.includes("criteo")
      || url.includes("creativecdn") || url.includes("haptickal")) return;
  try {
    const data = JSON.parse(await resp.text());
    if (!data || typeof data !== "object") return;

    const findArrays = (obj, prefix = "") => {
      const results = [];
      for (const [k, v] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${k}` : k;
        if (Array.isArray(v) && v.length > 0) {
          results.push({ path, len: v.length, sample: v[0] });
        } else if (v && typeof v === "object" && !Array.isArray(v) && prefix.split(".").length < 3) {
          results.push(...findArrays(v, path));
        }
      }
      return results;
    };

    const arrays = findArrays(data);
    if (arrays.length > 0) {
      console.log(`  🎯 ${url.slice(0, 110)}`);
      for (const a of arrays) {
        const keys = Object.keys(a.sample ?? {}).slice(0, 10).join(", ");
        console.log(`     ${a.path}[${a.len}] — keys: ${keys}`);
      }
    }
  } catch {}
});

// ── 1. Homepage ───────────────────────────────────────────────────────────
console.log("[1] Going to homepage...");
await page.goto("https://www.powerbuy.co.th/th", { waitUntil: "domcontentloaded", timeout: 30_000 });
await page.waitForTimeout(2_000);

// ── 2. Type in search box + Enter ─────────────────────────────────────────
console.log(`\n[2] Typing "${keyword}" in search box + Enter...`);
console.log("    (watch for 🎯 with product arrays)\n");

const searchInput = await page.waitForSelector(
  'input[placeholder*="ค้นหา"], input[placeholder*="search"], input[type="search"], [class*="search"] input',
  { timeout: 10_000 }
).catch(() => null);

if (searchInput) {
  await searchInput.click();
  await page.waitForTimeout(500);
  await searchInput.fill(keyword);
  await page.waitForTimeout(800);
  await page.keyboard.press("Enter");
  console.log("    ✅ Submitted search");
} else {
  console.log("    ❌ Search box not found — trying URL navigation");
  await page.goto(`https://www.powerbuy.co.th/th/search?keyword=${encodeURIComponent(keyword)}`,
    { waitUntil: "domcontentloaded", timeout: 30_000 });
}

await page.waitForTimeout(3_000);

// Scroll to trigger lazy loads + late API calls
for (let y = 0; y <= 2000; y += 400) {
  await page.evaluate(s => window.scrollTo(0, s), y);
  await page.waitForTimeout(400);
}
await page.waitForTimeout(2_000);

// ── 3. Check __NEXT_DATA__ for SSR product data ───────────────────────────
console.log("\n[3] Checking window.__NEXT_DATA__...");
const nextData = await page.evaluate(() => {
  try {
    const nd = window.__NEXT_DATA__;
    if (!nd) return null;
    // Recursively find arrays with product-like keys
    const findProductArrays = (obj, depth = 0) => {
      if (depth > 4 || !obj || typeof obj !== "object") return [];
      const results = [];
      for (const [k, v] of Object.entries(obj)) {
        if (Array.isArray(v) && v.length > 0 && v[0] && typeof v[0] === "object") {
          const keys = Object.keys(v[0]);
          if (keys.some(k => ["name","price","url","sku","PR_NAME","PR_PRICE","skcode"].includes(k))) {
            results.push({ path: k, len: v.length, sampleKeys: keys.slice(0, 10).join(", ") });
          }
        } else if (v && typeof v === "object" && !Array.isArray(v)) {
          results.push(...findProductArrays(v, depth + 1));
        }
      }
      return results;
    };
    return findProductArrays(nd);
  } catch { return null; }
});
if (nextData && nextData.length > 0) {
  console.log("  🎯 __NEXT_DATA__ product arrays:");
  nextData.forEach(a => console.log(`     ${a.path}[${a.len}] — keys: ${a.sampleKeys}`));
} else {
  console.log("  (no product arrays in __NEXT_DATA__)");
}

// ── 4. DOM inspection ─────────────────────────────────────────────────────
console.log("\n[4] DOM inspection...");
const domInfo = await page.evaluate(() => {
  const selectors = [
    '[class*="ProductCard"]', '[class*="product-card"]', '[class*="product-item"]',
    '[data-testid*="product"]', '[class*="SearchResult"]', '[class*="search-result"]',
    '[class*="ProductList"]', '[class*="item-card"]',
  ];
  const found = [];
  for (const sel of selectors) {
    const n = document.querySelectorAll(sel).length;
    if (n > 0) found.push(`${sel}: ${n}`);
  }
  // Show first 5 product card texts
  const cards = document.querySelectorAll('[class*="ProductCard"],[class*="product-card"],[class*="product-item"]');
  const samples = Array.from(cards).slice(0, 5).map(c => c.innerText?.split("\n")[0]?.trim()).filter(Boolean);
  return { found, samples };
});
console.log("  Selectors:", domInfo.found.join(" | ") || "(none)");
console.log("  First 5 card names:", domInfo.samples.join(" | ") || "(none)");

console.log("\n  Final URL:", page.url().slice(0, 120));
console.log("\n✅ Done — key: look for 🎯 lines that appeared AFTER [2]");

await ctx.close();
await browser.close();
