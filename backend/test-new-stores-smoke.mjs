/**
 * Smoke test for 6 new stores:
 *   JIB (jib.co.th), IT City (it24hrs.com), Studio 7 (studio7thailand.com),
 *   Apple TH (apple.com/th), Samsung TH (samsung.com/th), Sony TH (sony.co.th)
 *
 * For each store: navigate to search/product page, look for:
 *  - JSON API responses with product arrays
 *  - window.__NEXT_DATA__ / window.__NUXT__ / structured data
 *  - DOM product card selectors + price elements
 *
 * Usage: node test-new-stores-smoke.mjs [keyword]
 */
import { chromium } from "playwright";

const keyword = process.argv[2] || "iPhone 16";

const browser = await chromium.launch({
  headless: false,
  args: ["--no-sandbox", "--disable-blink-features=AutomationControlled",
         "--window-size=1366,768", "--window-position=100,100", "--lang=th-TH"],
  ignoreDefaultArgs: ["--enable-automation"],
});

async function probeStore({ name, url, waitMs = 3000 }) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🔍 ${name}`);
  console.log(`   URL: ${url}`);
  console.log("=".repeat(60));

  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "th-TH", timezoneId: "Asia/Bangkok", viewport: { width: 1366, height: 768 },
  });
  const page = await ctx.newPage();

  // ── Capture JSON API responses ────────────────────────────────────────────
  const apiHits = [];
  page.on("response", async (resp) => {
    const rUrl = resp.url();
    const ct   = resp.headers()["content-type"] ?? "";
    if (resp.status() !== 200 || !ct.includes("json")) return;
    if (rUrl.includes("gtm") || rUrl.includes("analytics") || rUrl.includes("criteo") ||
        rUrl.includes("facebook") || rUrl.includes("google") || rUrl.includes(".js")) return;
    try {
      const data = JSON.parse(await resp.text());
      if (!data || typeof data !== "object") return;
      const findArrays = (obj, prefix = "", depth = 0) => {
        const out = [];
        if (depth > 3) return out;
        for (const [k, v] of Object.entries(obj ?? {})) {
          const p = prefix ? `${prefix}.${k}` : k;
          if (Array.isArray(v) && v.length > 0 && v[0] && typeof v[0] === "object") {
            const keys = Object.keys(v[0]).slice(0, 8).join(", ");
            out.push({ p, len: v.length, keys, sample: v[0] });
          } else if (v && typeof v === "object" && !Array.isArray(v)) {
            out.push(...findArrays(v, p, depth + 1));
          }
        }
        return out;
      };
      const arrs = findArrays(data);
      if (arrs.length > 0) {
        apiHits.push({ url: rUrl.slice(0, 100), arrs });
      }
    } catch {}
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35_000 });
    await page.waitForTimeout(waitMs);

    // scroll a bit
    for (let y = 0; y <= 1500; y += 400) {
      await page.evaluate(s => window.scrollTo(0, s), y).catch(() => {});
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(1500);

    // ── Print API hits ──────────────────────────────────────────────────────
    if (apiHits.length > 0) {
      console.log("\n📡 JSON API responses with arrays:");
      for (const hit of apiHits.slice(0, 5)) {
        console.log(`  ${hit.url}`);
        for (const a of hit.arrs.slice(0, 3)) {
          console.log(`    ${a.p}[${a.len}] — keys: ${a.keys}`);
        }
      }
    } else {
      console.log("\n📡 No JSON API product arrays captured");
    }

    // ── Check for SSR global data ─────────────────────────────────────────
    const ssrInfo = await page.evaluate(() => {
      const keys = [];
      if ((window).__NEXT_DATA__) keys.push("__NEXT_DATA__");
      if ((window).__NUXT__) keys.push("__NUXT__");
      if ((window).__INITIAL_STATE__) keys.push("__INITIAL_STATE__");
      // Check for JSON-LD
      const jsonLds = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
        .map(s => { try { return JSON.parse(s.textContent); } catch { return null; } })
        .filter(Boolean);
      return { globals: keys, jsonLdCount: jsonLds.length,
               jsonLdTypes: jsonLds.map(j => j["@type"] ?? j.type ?? "?").slice(0, 5) };
    }).catch(() => ({ globals: [], jsonLdCount: 0, jsonLdTypes: [] }));

    console.log(`\n🌐 SSR globals: ${ssrInfo.globals.join(", ") || "(none)"}`);
    console.log(`   JSON-LD blocks: ${ssrInfo.jsonLdCount} — types: ${ssrInfo.jsonLdTypes.join(", ")}`);

    // ── DOM inspection ────────────────────────────────────────────────────
    const dom = await page.evaluate(() => {
      const selectors = [
        '[class*="product"]', '[class*="Product"]',
        '[class*="item"]',    '[class*="Item"]',
        '[class*="card"]',    '[class*="Card"]',
        '[class*="price"]',   '[class*="Price"]',
        '[data-product]', '[data-sku]', '[data-price]',
        'article', '.product-item', '.product-card',
      ];
      const counts = {};
      for (const sel of selectors) {
        const n = document.querySelectorAll(sel).length;
        if (n > 0) counts[sel] = n;
      }
      // price text elements
      const priceEls = [];
      for (const el of document.querySelectorAll("*")) {
        if (el.children.length === 0) {
          const t = el.textContent?.trim() ?? "";
          if ((t.includes("฿") || t.includes(",") && /\d{4,}/.test(t)) && t.length < 30) {
            const cls = (el.className ?? "").slice(0, 60);
            if (!priceEls.includes(cls) && cls) priceEls.push(cls);
            if (priceEls.length >= 6) break;
          }
        }
      }
      // product links
      const links = Array.from(document.querySelectorAll("a[href*='/product'],a[href*='/p/'],a[href*='/th/product']"))
        .slice(0, 4).map(a => ({ href: a.href.slice(0, 80), text: a.textContent?.trim().slice(0, 50) }));
      return { counts, priceEls, links };
    }).catch(() => ({ counts: {}, priceEls: [], links: [] }));

    if (Object.keys(dom.counts).length > 0) {
      console.log("\n🏷  DOM counts (non-zero):");
      Object.entries(dom.counts).forEach(([sel, n]) => console.log(`    ${sel}: ${n}`));
    }
    if (dom.priceEls.length > 0) {
      console.log("💰 Price element classes:");
      dom.priceEls.forEach(c => console.log(`    ${c}`));
    }
    if (dom.links.length > 0) {
      console.log("🔗 Product links:");
      dom.links.forEach(l => console.log(`    ${l.href}\n      "${l.text}"`));
    }

    console.log(`\n📍 Final URL: ${page.url().slice(0, 100)}`);

  } catch (err) {
    console.log(`\n❌ Error: ${err.message.slice(0, 100)}`);
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ── Run all stores ────────────────────────────────────────────────────────────
const kw = encodeURIComponent(keyword);

await probeStore({ name: "JIB Computer",
  url: `https://www.jib.co.th/web/search?cate_id=0&ctype=0&keyword=${kw}` });

await probeStore({ name: "IT City (iT24Hrs)",
  url: `https://www.it24hrs.com/th/productlist?q=${kw}` });

await probeStore({ name: "Studio 7 Thailand",
  url: `https://www.studio7thailand.com/search?q=${kw}` });

await probeStore({ name: "Apple Store TH (search page)",
  url: `https://www.apple.com/th/search/${encodeURIComponent(keyword)}?src=globalnav`, waitMs: 4000 });

await probeStore({ name: "Samsung Thailand (Galaxy S25)",
  url: `https://www.samsung.com/th/smartphones/galaxy-s25/`, waitMs: 4000 });

await probeStore({ name: "Sony Thailand (headphones)",
  url: `https://www.sony.co.th/en/electronics/search?q=${kw}`, waitMs: 3000 });

await browser.close();
console.log("\n✅ All stores probed\n");
