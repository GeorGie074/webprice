/**
 * JIB search URL discovery + Samsung/Sony deep probe.
 * Usage: node test-jib-smoke3.mjs
 */
import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: false,
  args: ["--no-sandbox","--disable-blink-features=AutomationControlled",
         "--window-size=1366,768","--window-position=100,100"],
  ignoreDefaultArgs: ["--enable-automation"],
});
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ── Helper ────────────────────────────────────────────────────────────────────
async function probe(name, searchUrl, productSelector = null) {
  console.log(`\n${"=".repeat(60)}\n🔍 ${name}\n${"=".repeat(60)}`);
  const ctx = await browser.newContext({ userAgent: UA, locale: "th-TH", timezoneId: "Asia/Bangkok", viewport: {width:1366,height:768} });
  const page = await ctx.newPage();
  const apis = [];
  page.on("response", async (resp) => {
    const url = resp.url(); const ct = resp.headers()["content-type"]??"";
    if (resp.status()!==200||!ct.includes("json")) return;
    if (url.includes("gtm")||url.includes("analytics")||url.includes("google")||url.includes("facebook")) return;
    try {
      const d = JSON.parse(await resp.text());
      const flat = (obj,p="",dep=0)=>{const r=[];if(dep>3||!obj||typeof obj!=="object")return r;for(const[k,v]of Object.entries(obj)){const pp=p?`${p}.${k}`:k;if(Array.isArray(v)&&v.length>0&&v[0]&&typeof v[0]==="object"){r.push({pp,len:v.length,keys:Object.keys(v[0]).slice(0,6).join(",")})}else if(v&&typeof v==="object"&&!Array.isArray(v))r.push(...flat(v,pp,dep+1))}return r};
      const arr = flat(d);
      if(arr.length) apis.push({url:url.slice(0,100),arr});
    } catch {}
  });
  try {
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 35_000 });
    await page.waitForTimeout(3000);
    for(let y=0;y<=1500;y+=400){await page.evaluate(s=>window.scrollTo(0,s),y).catch(()=>{});await page.waitForTimeout(300);}
    await page.waitForTimeout(2000);

    if(apis.length){
      console.log("📡 JSON APIs:");
      apis.slice(0,4).forEach(h=>{
        console.log(`  ${h.url}`);
        h.arr.slice(0,2).forEach(a=>console.log(`    ${a.pp}[${a.len}] keys: ${a.keys}`));
      });
    } else { console.log("📡 No JSON API arrays"); }

    const dom = await page.evaluate((sel)=>{
      const counts={};
      for(const s of["[class*='product']","[class*='item']","[class*='card']","article","li.product",".product-item"]){const n=document.querySelectorAll(s).length;if(n>0)counts[s]=n;}
      // price scan
      const prices=[];
      for(const el of document.querySelectorAll("*")){if(el.children.length>0)continue;const t=el.textContent?.trim()??"";if((t.includes("฿")||(/\d{3,6}/.test(t.replace(/,/g,""))&&t.length<20))){prices.push((el.className||el.tagName).slice(0,50));if(prices.length>=5)break;}}
      // Try explicit selector
      const cards = sel ? Array.from(document.querySelectorAll(sel)) : [];
      const samples = cards.slice(0,4).map(c=>{
        const name = c.querySelector("h4,h3,h2,[class*='name'],[class*='title']")?.textContent?.trim().slice(0,60)??"";
        const price = c.querySelector("[class*='price'],[class*='Price'],span.font-bold,[class*='cost']")?.textContent?.trim().slice(0,30)??"";
        return {name,price};
      }).filter(s=>s.name||s.price);
      return {counts, prices, samples, url: location.href.slice(0,100)};
    }, productSelector);

    console.log("🏷  DOM:", dom.counts);
    console.log("💰 Price classes:", dom.prices);
    if(dom.samples.length) { console.log("📦 Samples:"); dom.samples.forEach((s,i)=>console.log(`  [${i}] "${s.name}" | "${s.price}"`)); }
    console.log("📍 URL:", dom.url);
  } catch(e){ console.log("❌",e.message.slice(0,80)); }
  await ctx.close();
}

// ── JIB ──────────────────────────────────────────────────────────────────────
await probe("JIB — homepage → search",
  "https://www.jib.co.th", null);

// After homepage loads, try the search URL pattern
{
  const ctx = await browser.newContext({ userAgent: UA, locale:"th-TH",timezoneId:"Asia/Bangkok",viewport:{width:1366,height:768} });
  const page = await ctx.newPage();
  const apis2=[];
  page.on("response",async(resp)=>{
    const url=resp.url();const ct=resp.headers()["content-type"]??"";
    if(resp.status()!==200||!ct.includes("json"))return;
    if(url.includes("gtm")||url.includes("google"))return;
    try{const d=JSON.parse(await resp.text());const flat=(o,p="",dep=0)=>{const r=[];if(dep>3||!o||typeof o!=="object")return r;for(const[k,v]of Object.entries(o)){const pp=p?`${p}.${k}`:k;if(Array.isArray(v)&&v.length>0&&v[0]&&typeof v[0]==="object"){r.push({pp,len:v.length,keys:Object.keys(v[0]).slice(0,6).join(",")})}else if(v&&typeof v==="object"&&!Array.isArray(v))r.push(...flat(v,pp,dep+1))}return r};const arr=flat(d);if(arr.length)apis2.push({url:url.slice(0,120),arr});}catch{}
  });
  console.log("\n--- JIB: trying /web/product_list?cate_id=0&ctype=0&keyword=iPhone+16 ---");
  await page.goto("https://www.jib.co.th/web/product_list?cate_id=0&ctype=0&keyword=iPhone+16",{waitUntil:"domcontentloaded",timeout:30_000}).catch(()=>{});
  await page.waitForTimeout(3000);
  const url1 = page.url();
  const title1 = await page.title().catch(()=>"?");
  console.log(`  URL: ${url1}\n  Title: ${title1}`);
  if(apis2.length){console.log("  APIs:");apis2.slice(0,3).forEach(h=>console.log(`    ${h.url}  → ${h.arr.slice(0,2).map(a=>`${a.pp}[${a.len}]`).join(", ")}`))}
  const samples = await page.evaluate(()=>{
    const items = document.querySelectorAll(".product-item,.pro-list-item,[class*='ProductItem'],.col-md-3 a,[class*='product']");
    return Array.from(items).slice(0,4).map(el=>el.textContent?.trim().slice(0,60)).filter(Boolean);
  }).catch(()=>[]);
  console.log("  DOM text samples:", samples);
  await ctx.close();
}

// ── Samsung deep probe ────────────────────────────────────────────────────────
await probe("Samsung TH — Galaxy S25 product page",
  "https://www.samsung.com/th/smartphones/galaxy-s25/buy/?modelCode=SM-S931BZKDTHS", "[data-sku],[data-price]");

// ── Sony deep probe (with XM6 keyword) ────────────────────────────────────────
await probe("Sony TH — WH-1000XM6 search",
  "https://www.sony.co.th/en/search/?text=WH-1000XM6", null);

await browser.close();
console.log("\n✅ Done\n");
