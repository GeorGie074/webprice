/**
 * JIB — use actual search box to find the real search URL pattern.
 * Usage: node test-jib-searchbox.mjs "iPhone 16"
 */
import { chromium } from "playwright";
const keyword = process.argv[2] || "iPhone 16";

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

const apis = [];
page.on("response", async (resp) => {
  const url = resp.url();
  if (resp.status() !== 200) return;
  const ct = resp.headers()["content-type"] ?? "";
  if (!ct.includes("json")) return;
  if (url.includes("gtm")||url.includes("analytics")||url.includes("google")||url.includes("facebook")) return;
  try {
    const data = JSON.parse(await resp.text());
    const flat = (o,p="",d=0)=>{const r=[];if(d>3||!o||typeof o!=="object")return r;for(const[k,v]of Object.entries(o)){const pp=p?`${p}.${k}`:k;if(Array.isArray(v)&&v.length>0&&v[0]&&typeof v[0]==="object"){r.push({pp,len:v.length,keys:Object.keys(v[0]).slice(0,6).join(",")})}else if(v&&typeof v==="object"&&!Array.isArray(v))r.push(...flat(v,pp,d+1))}return r};
    const arr = flat(data);
    if (arr.length) apis.push({ url: url.slice(0, 120), arr, data });
  } catch {}
});

// Load JIB homepage
console.log("[1] Loading JIB homepage...");
await page.goto("https://www.jib.co.th/web/", { waitUntil: "domcontentloaded", timeout: 30_000 });
await page.waitForTimeout(2000);

// Find and use search box
console.log(`[2] Searching for "${keyword}"...`);
const searchBox = await page.waitForSelector(
  'input[type="search"], input[placeholder*="ค้น"], input[placeholder*="search"], #search, [class*="search"] input',
  { timeout: 8000 }
).catch(() => null);

if (searchBox) {
  await searchBox.click();
  await page.waitForTimeout(500);
  await searchBox.fill(keyword);
  await page.waitForTimeout(800);
  await page.keyboard.press("Enter");
  console.log("   ✅ Search submitted");
  await page.waitForTimeout(3000);
} else {
  // Try direct URL variations
  console.log("   ❌ No search box — trying direct URLs...");
  const tryUrls = [
    `https://www.jib.co.th/web/search?keyword=${encodeURIComponent(keyword)}`,
    `https://www.jib.co.th/web/product_search?keyword=${encodeURIComponent(keyword)}`,
    `https://www.jib.co.th/web/?s=${encodeURIComponent(keyword)}`,
  ];
  for (const u of tryUrls) {
    await page.goto(u, { waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => {});
    const title = await page.title().catch(() => "");
    console.log(`   ${u} → "${title.slice(0, 40)}"`);
    if (!title.includes("404")) break;
  }
}

await page.waitForTimeout(2000);
console.log(`\n[3] Final URL: ${page.url()}`);

// Print API hits
if (apis.length) {
  console.log("\n📡 API responses:");
  apis.slice(0, 5).forEach(h => {
    console.log(`  ${h.url}`);
    h.arr.slice(0, 2).forEach(a => console.log(`    ${a.pp}[${a.len}] keys: ${a.keys}`));
  });
}

// DOM inspection
const dom = await page.evaluate(() => {
  // JIB uses PHP server-side rendering, look for product cards
  const selMap = {
    ".col-md-3": document.querySelectorAll(".col-md-3").length,
    ".col-sm-4": document.querySelectorAll(".col-sm-4").length,
    "[class*='pro-box']": document.querySelectorAll("[class*='pro-box']").length,
    "[class*='product']": document.querySelectorAll("[class*='product']").length,
    "li[class*='col']": document.querySelectorAll("li[class*='col']").length,
    ".item": document.querySelectorAll(".item").length,
    "[class*='ProductItem']": document.querySelectorAll("[class*='ProductItem']").length,
  };

  // Sample product cards
  const colDivs = document.querySelectorAll(".col-md-3,.col-sm-4,li[class*='col']");
  const samples = Array.from(colDivs).slice(0, 6).map(el => {
    const link = el.querySelector("a");
    const name = el.querySelector("p,h4,h3,span[class*='name']")?.textContent?.trim().slice(0, 60) ?? "";
    const price = el.querySelector("[class*='price'],b,strong")?.textContent?.trim().slice(0, 30) ?? "";
    return { name, price, href: link?.href?.slice(0, 80) ?? "" };
  }).filter(s => s.name || s.price);

  // All classes in first 100 elements
  const classCount = {};
  for (const el of Array.from(document.querySelectorAll("*")).slice(0, 500)) {
    for (const cls of (el.className?.toString()?.split?.(" ") ?? [])) {
      if (cls && cls.length > 2) classCount[cls] = (classCount[cls] ?? 0) + 1;
    }
  }
  const topClasses = Object.entries(classCount).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([k,v])=>`${k}(${v})`);

  return { selMap, samples, topClasses, title: document.title.slice(0,50) };
});

console.log(`\nTitle: ${dom.title}`);
console.log("DOM counts:", dom.selMap);
if (dom.samples.length) { console.log("Product samples:"); dom.samples.forEach((s,i)=>console.log(`  [${i}] "${s.name}" | ฿ "${s.price}" | ${s.href}`)); }
console.log("Top CSS classes:", dom.topClasses.slice(0,10).join(", "));

await ctx.close();
await browser.close();
