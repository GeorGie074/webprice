/**
 * Final BNN DOM structure test — iPhone 16 + Samsung Galaxy S25 pages
 * to understand product card HTML for building the scraper.
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

async function scrapePage(url) {
  console.log(`\n${"─".repeat(60)}\n[Scrape] ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForTimeout(2000);
  for (let i=0;i<=6;i++){await page.evaluate(s=>window.scrollTo(0,s*300),i);await page.waitForTimeout(300);}
  await page.waitForTimeout(1500);

  const result = await page.evaluate(() => {
    // Find the product items container
    const allItems = [...document.querySelectorAll('[class*="product-item"]')]
      .filter(el => {
        const t = el.innerText;
        return t && t.length > 20;
      });

    return allItems.slice(0, 8).map(el => {
      const text = el.innerText;
      // Find price
      const priceMatch = text.match(/฿\s*([\d,]+)/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;

      // Find product name (look for text lines, skip short ones and navigation)
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 10);
      const name = lines.find(l => !l.startsWith('฿') && !l.startsWith('฿') &&
        l !== 'APPLE' && l !== 'SAMSUNG' && l !== 'ASUS' && l !== 'SONY' &&
        !l.includes('หน้าหลัก') && !l.includes('สินค้าหมด') &&
        l.length > 15) || lines[0] || '';

      // Find link — check element itself, its parent chain, and children
      let link = '';
      let el2 = el;
      for (let i = 0; i < 5; i++) {
        if (el2.tagName === 'A' && el2.href) { link = el2.href; break; }
        if (el2.parentElement) el2 = el2.parentElement;
        else break;
      }
      if (!link) {
        const a = el.querySelector('a');
        link = a?.href || '';
      }

      return { name: name.slice(0, 80), price, link: link.slice(0, 100), raw: text.split('\n').filter(Boolean).slice(0,5).join(' | ').slice(0,150) };
    });
  });

  console.log(`  Products found: ${result.length}`);
  result.forEach((p, i) => {
    console.log(`  [${i}] ฿${p.price || '?'} "${p.name}" → ${p.link || 'NO LINK'}`);
    console.log(`       raw: ${p.raw}`);
  });

  return result;
}

// Test iPhone 16 page
await scrapePage("https://www.bnn.in.th/p/apple/iphone/iphone-16");

// Find Samsung page URL
console.log("\n\n[Discover] Samsung URLs...");
const samsungUrls = [
  "https://www.bnn.in.th/p/smartphone-and-accessories/samsung/galaxy-s25",
  "https://www.bnn.in.th/p/smartphone-and-accessories/samsung",
  "https://www.bnn.in.th/p/smartphone-and-accessories/samsung/samsung-galaxy-s25",
];
for (const u of samsungUrls) {
  await page.goto(u, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(()=>{});
  const title = await page.title();
  const isError = title.includes("ขออภัย") || title.includes("404");
  console.log(`  ${isError?'❌':'✅'} ${u.replace("https://www.bnn.in.th","")} → "${title.slice(0,60)}"`);
  if (!isError) {
    await page.waitForTimeout(1500);
    const dom = await page.evaluate(() => {
      const found = [...document.querySelectorAll('[class*="product-item"]')].filter(el=>el.innerText.includes('฿'));
      return found.slice(0,3).map(el => {
        const priceMatch = el.innerText.match(/฿\s*([\d,]+)/);
        const lines = el.innerText.split('\n').filter(l=>l.trim().length>15).slice(0,2);
        return `฿${priceMatch?.[1]||'?'} "${lines[0]?.slice(0,60)||''}"`;
      });
    });
    dom.forEach(d=>console.log(`      → ${d}`));
    if (!isError) break;
  }
}

// Test Sony/ASUS/MacBook Air pages
const otherPages = [
  "https://www.bnn.in.th/p/audio/sony",
  "https://www.bnn.in.th/p/audio",
  "https://www.bnn.in.th/p/audio-and-headphone/sony",
  "https://www.bnn.in.th/p/apple/apple-mac/macbook-air",
  "https://www.bnn.in.th/p/notebook/asus/asus-rog",
  "https://www.bnn.in.th/p/notebook/asus/asus-rog-zephyrus",
  "https://www.bnn.in.th/p/notebook/asus/asus-rog-zephyrus-g14",
];
console.log("\n[Discover] Other category URLs...");
for (const u of otherPages) {
  await page.goto(u, { waitUntil: "domcontentloaded", timeout: 10000 }).catch(()=>{});
  const title = await page.title();
  const isError = title.includes("ขออภัย") || title.includes("404");
  const prodCount = isError ? 0 : await page.evaluate(() =>
    document.querySelectorAll('[class*="product-item"]').length
  ).catch(()=>0);
  console.log(`  ${isError?'❌':'✅'} ${u.replace("https://www.bnn.in.th","").padEnd(50)} ${prodCount} products → "${title.slice(0,50)}"`);
}

await ctx.close();
await browser.close();
console.log("\n✅ Done");
