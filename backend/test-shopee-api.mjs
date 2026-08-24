/**
 * Shopee API interception smoke test.
 *
 * Uses playwright-extra + StealthPlugin + real Chrome (channel:'chrome') —
 * identical browser config to setup-shopee-session.mjs so fingerprints match.
 *
 * Run BEFORE enabling scrapeShopee() with a fresh account:
 *   node test-shopee-api.mjs                    ← default: "iPhone 16"
 *   node test-shopee-api.mjs "MacBook Air M5"
 *   node test-shopee-api.mjs "Sony WH-1000XM6"
 *
 * What to verify:
 *   ✅  API captured N items  (not 0)
 *   ✅  Prices look correct (e.g. ฿24,900 not ฿2,490,000,000)
 *   ✅  Product URLs are valid shopee.co.th/product/shopid/itemid format
 *   ✅  No anti-bot/captcha page
 */
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { existsSync } from "fs";

chromium.use(StealthPlugin());

const keyword      = process.argv[2] || "iPhone 16";
const SESSION_FILE = "shopee-session.json";

if (!existsSync(SESSION_FILE)) {
  console.log(`❌ ${SESSION_FILE} not found.`);
  console.log("   Run first:  node setup-shopee-session.mjs");
  process.exit(1);
}

// ── Real Chrome + StealthPlugin (matches setup-shopee-session.mjs exactly) ──
const browser = await chromium.launch({
  channel: "chrome",  // ← real installed Chrome — legitimate fingerprint
  headless: false,
  args: [
    "--no-sandbox", "--disable-setuid-sandbox",
    "--disable-blink-features=AutomationControlled",
    "--window-size=1366,768",
    "--window-position=100,100",  // VISIBLE — needed to solve CAPTCHA manually
    "--lang=th-TH",
  ],
  ignoreDefaultArgs: ["--enable-automation"],
});

const ctx = await browser.newContext({
  storageState: SESSION_FILE,
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  locale: "th-TH", timezoneId: "Asia/Bangkok", viewport: { width: 1366, height: 768 },
  extraHTTPHeaders: {
    "accept-language": "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7",
    "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
  },
});

// Additional stealth patches on top of StealthPlugin
await ctx.addInitScript(`
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'plugins',   { get: () => [1,2,3,4,5] });
  Object.defineProperty(navigator, 'languages', { get: () => ['th-TH','th','en-US','en'] });
  window.chrome = { runtime: {}, loadTimes: function(){}, csi: function(){}, app: {} };
`);

const page = await ctx.newPage();

// ── 1. Homepage warm-up ────────────────────────────────────────────────────
console.log("[1] Warming up homepage...");
await page.goto("https://shopee.co.th/", { waitUntil: "domcontentloaded", timeout: 25_000 });
await page.waitForTimeout(4_000);

const cookies = await ctx.cookies("https://shopee.co.th");
const hasSPCF = cookies.some(c => c.name === "SPC_F");
const hasSPCU = cookies.some(c => c.name === "SPC_U");
console.log(`    Cookies: ${cookies.length} total | SPC_F: ${hasSPCF ? "✅" : "❌"} | SPC_U (logged in): ${hasSPCU ? "✅" : "❌"}`);
if (!hasSPCF) {
  console.log("    ⚠️  SPC_F missing — Shopee JS may not have run. Waiting extra 3s...");
  await page.waitForTimeout(3_000);
}

// ── 2. Register response handler BEFORE navigation ───────────────────────
const searchUrl = `https://shopee.co.th/search?keyword=${encodeURIComponent(keyword)}&sortBy=relevancy`;
console.log(`\n[2] Searching "${keyword}"...`);

let capturedItems = null;

page.on("response", async (resp) => {
  if (resp.url().includes("/api/v4/search/search_items") && resp.status() === 200) {
    try {
      const data = await resp.json();
      const items = data?.items ?? [];
      if (items.length > 0) {
        capturedItems = items;
        console.log(`    📦 API captured ${items.length} items`);
      }
    } catch (e) {
      console.log("    ⚠️  API response parse failed:", e.message);
    }
  }
});

await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
console.log("    Final URL:", page.url().slice(0, 90));

// Scroll with mouse wheel — real input event (harder to detect than window.scrollTo)
await page.mouse.move(683, 400).catch(() => {});
for (let i = 0; i < 5; i++) {
  try { await page.mouse.wheel(0, 300); } catch { break; }
  await page.waitForTimeout(400);
}
await page.waitForTimeout(1_500);

// ── CAPTCHA handler ────────────────────────────────────────────────────────
async function handleCaptcha(label) {
  const url = page.url();
  if (!url.includes("verify/captcha") && !url.includes("verify/traffic")) return false;

  console.log(`\n⚠️  CAPTCHA detected${label ? " " + label : ""}!`);
  console.log("   ┌─────────────────────────────────────────────────────┐");
  console.log("   │  👉  SWITCH TO THE BROWSER WINDOW NOW and solve it  │");
  console.log("   │      You have 3 minutes (180 seconds)               │");
  console.log("   └─────────────────────────────────────────────────────┘");

  const deadline = Date.now() + 180_000;
  let solved = false;
  while (Date.now() < deadline) {
    const remaining = Math.ceil((deadline - Date.now()) / 1000);
    process.stdout.write(`\r   ⏳ ${remaining}s remaining...`);
    try {
      if (!page.url().includes("/verify/")) { solved = true; break; }
    } catch { break; }
    await new Promise(r => setTimeout(r, 1_000));
  }
  process.stdout.write("\r" + " ".repeat(40) + "\r");

  if (solved) {
    console.log("   ✅ CAPTCHA solved! Re-navigating to search...");
    return true;
  } else {
    console.log("   ❌ CAPTCHA not solved in 180s.");
    return false;
  }
}

const captchaSolved = await handleCaptcha("(after search navigation)");
if (captchaSolved) {
  page.on("response", async (resp) => {
    if (resp.url().includes("/api/v4/search/search_items") && resp.status() === 200) {
      try {
        const data  = await resp.json();
        const items = data?.items ?? [];
        if (items.length > 0 && !capturedItems) {
          capturedItems = items;
          console.log(`    📦 API captured ${items.length} items (after CAPTCHA)`);
        }
      } catch {}
    }
  });
  await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.mouse.move(683, 400).catch(() => {});
  for (let i = 0; i < 5; i++) {
    try { await page.mouse.wheel(0, 300); } catch { break; }
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(2_000);
  await handleCaptcha("(after retry)");
}

// ── 3. Parse results ───────────────────────────────────────────────────────
if (!capturedItems) {
  console.log("\n❌ API NOT intercepted");
  const title = await page.title().catch(() => "?");
  const url   = page.url();
  console.log("   Page title:", title.slice(0, 80));
  console.log("   Final URL: ", url.slice(0, 100));
  if (url.includes("verify") || url.includes("captcha")) {
    console.log("\n🚫 Anti-bot page — SPC_F fingerprint still detected as bot.");
    console.log("   The bundled-Chromium fingerprint was blocked even with real Chrome.");
  }
} else {
  const items = capturedItems;
  if (!items || items.length === 0) {
    console.log("\n⚠️  API captured but items[] is empty");
  } else {
    console.log(`\n✅ Showing top results:`);
    console.log("─".repeat(72));
    for (const item of items.slice(0, 8)) {
      const b        = item.item_basic ?? item;
      const rawPrice = b.price ?? b.price_min ?? 0;
      const price    = rawPrice / 100_000;
      const url      = `https://shopee.co.th/product/${b.shopid}/${b.itemid}`;
      const ratingCounts = b.item_rating?.rating_count ?? [];
      const reviews  = ratingCounts.reduce((a, n) => a + (n ?? 0), 0);
      const inStock  = (b.stock ?? 1) > 0;
      console.log(`  ฿${String(price.toLocaleString("th")).padEnd(10)} ⭐${(b.item_rating?.rating_star ?? 0).toFixed(1)} | ${inStock ? "✅" : "❌"} | ${reviews} reviews`);
      console.log(`  "${(b.name ?? "").slice(0, 65)}"`);
      console.log(`   → ${url}`);
    }
    console.log("─".repeat(72));
    const prices = items.map(i => ((i.item_basic ?? i).price ?? 0) / 100_000).filter(Boolean);
    console.log(`Price range: ฿${Math.min(...prices).toLocaleString()} – ฿${Math.max(...prices).toLocaleString()}`);
    console.log(`\n✅ API interception working — safe to enable scrapeShopee() in shopee.ts`);
  }
}

// ── 4. Anti-bot check ──────────────────────────────────────────────────────
const finalUrl = page.url();
if (finalUrl.includes("verify") || finalUrl.includes("captcha") || finalUrl.includes("blocked")) {
  console.log("\n🚫 Redirected to anti-bot page:", finalUrl.slice(0, 100));
} else if (capturedItems) {
  console.log("\n✅ No anti-bot signals detected");
}

await ctx.close();
await browser.close();
