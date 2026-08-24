/**
 * BNN: navigate by CLICKING links from homepage (not URL navigation)
 * to find working category pages and their product API calls.
 */
import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: false,
  args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage",
         "--disable-blink-features=AutomationControlled",
         "--window-size=1366,768","--window-position=-8000,-8000","--lang=th-TH"],
  ignoreDefaultArgs: ["--enable-automation"],
});
const ctx = await browser.newContext({
  userAgent:"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  locale:"th-TH",timezoneId:"Asia/Bangkok",viewport:{width:1366,height:768},
  extraHTTPHeaders:{"accept-language":"th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7"},
});
await ctx.addInitScript(`Object.defineProperty(navigator,'webdriver',{get:()=>undefined});`);
const page = await ctx.newPage();

const productApis = [];
page.on("response", async resp => {
  const url = resp.url();
  if (!url.includes("api.bnn.in.th")) return;
  const ct = resp.headers()["content-type"] || "";
  if (!ct.includes("json")) return;
  try {
    const json = await resp.json();
    const arr = json.data || [];
    if (Array.isArray(arr) && arr.length > 0 && arr[0]?.name && arr[0]?.slug) {
      // Check if it's a product (not category/page)
      const hasPrice = arr.some(it => it.price_display || it.sale_price || it.price);
      productApis.push({ url, arr, hasPrice });
      if (hasPrice) {
        console.log(`\n  ✅ PRODUCT API: ${url}`);
        arr.slice(0,5).forEach((it,i) => {
          const price = it.price_display || it.sale_price || it.price || 0;
          console.log(`    [${i}] ฿${price} "${(it.name||"").slice(0,60)}" slug=${it.slug||""}`);
        });
      } else {
        console.log(`  [${arr[0].name ? 'data' : 'other'}] ${url.slice(0,80)}: ${arr.length} items`);
      }
    }
  } catch {}
});

console.log("[1] Loading BNN homepage...");
await page.goto("https://www.bnn.in.th/th", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(2000);

// Get ALL navigation links
const navLinks = await page.evaluate(() => {
  const links = [...document.querySelectorAll('nav a, header a, [class*="menu"] a, [class*="nav"] a')];
  return links.slice(0,30).map(a => ({ href: a.href, text: a.innerText.trim().slice(0,30) }))
    .filter(l => l.href && l.href.includes("bnn.in.th") && !l.href.endsWith("/th") && !l.href.endsWith("/en"));
});
console.log("\n  Nav links:");
navLinks.slice(0,15).forEach((l,i) => console.log(`    [${i}] ${l.text.padEnd(25)} → ${l.href}`));

// Click on Apple/iPhone category link
const appleLink = navLinks.find(l =>
  l.text.includes("Apple") || l.text.includes("แอปเปิ้ล") || l.text.includes("แอปเปิล") ||
  l.href.includes("apple") || l.href.includes("iphone")
);
if (appleLink) {
  console.log(`\n[2] Clicking: "${appleLink.text}" → ${appleLink.href}`);
  productApis.length = 0;
  await page.click(`a[href="${appleLink.href}"]`).catch(async () => {
    await page.goto(appleLink.href, { waitUntil: "domcontentloaded", timeout: 20000 });
  });
  await page.waitForTimeout(3000);
  for (let i = 0; i <= 5; i++) { await page.evaluate(s=>window.scrollTo(0,s*300),i); await page.waitForTimeout(300); }
  await page.waitForTimeout(2000);

  const title = await page.title();
  const url   = page.url();
  console.log(`  After: "${title.slice(0,60)}" | ${url.slice(0,80)}`);

  // DOM
  const dom = await page.evaluate(() => {
    const sels = ['[class*="product"]','[class*="Product"]','[class*="card"]','[class*="item"]'];
    for (const sel of sels) {
      const found = [...document.querySelectorAll(sel)].filter(el => el.innerText.includes("฿"));
      if (found.length > 0) return found.slice(0,3).map(el=>({sel,text:el.innerText.split('\n').filter(Boolean).slice(0,3).join(' | ').slice(0,120)}));
    }
    return [{sel:'body', text: document.body.innerText.slice(0,400)}];
  });
  dom.forEach((d,i)=>console.log(`  DOM[${i}](${d.sel}): ${d.text}`));
} else {
  console.log("\n  No Apple link found in nav");
  // Show all collected links
  const allLinks = await page.evaluate(() =>
    [...document.querySelectorAll('a')].filter(a => a.href.includes("bnn")).slice(0,20)
      .map(a => ({ href: a.href, text: a.innerText.trim().slice(0,30) }))
  );
  console.log("  All BNN links:");
  allLinks.forEach((l,i) => console.log(`    [${i}] ${l.text.padEnd(25)} ${l.href}`));
}

// Try BNN sitemap to find correct category URLs
console.log("\n[3] Checking BNN sitemap...");
const sitemap = await page.evaluate(async () => {
  const r = await fetch("https://www.bnn.in.th/sitemap.xml").catch(()=>null);
  return r ? (await r.text()).slice(0, 2000) : "no sitemap";
});
console.log("  sitemap:", sitemap.slice(0, 500));

await ctx.close();
await browser.close();
console.log("\n✅ Done");
