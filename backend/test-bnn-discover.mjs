/**
 * Quick discovery of BNN category URLs for remaining products.
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

async function tryUrls(label, urls) {
  console.log(`\n${label}:`);
  for (const u of urls) {
    await page.goto(u, { waitUntil: "domcontentloaded", timeout: 12000 }).catch(()=>{});
    const title = await page.title().catch(()=>"?");
    const err = title.includes("ขออภัย") || title.includes("404");
    if (!err) {
      await page.waitForTimeout(1500);
      for (let i=0;i<=4;i++){await page.evaluate(s=>window.scrollTo(0,s*300),i);await page.waitForTimeout(200);}
      const items = await page.evaluate(() => {
        const found = [...document.querySelectorAll('[class*="product-item"]')]
          .filter(el => el.innerText.includes('฿'));
        return found.slice(0,3).map(el => {
          const pm = el.innerText.match(/฿\s*([\d,]+)/);
          const link = (() => {
            let e=el; for(let i=0;i<5;i++){if(e.tagName==='A')return e.href;if(e.parentElement)e=e.parentElement;else break;}
            return el.querySelector('a')?.href || '';
          })();
          const lines = el.innerText.split('\n').map(l=>l.trim()).filter(l=>l.length>10 && !l.match(/^[A-Z]+$/) && !l.includes('หน้าหลัก') && !l.includes('ประหยัด'));
          return { name:(lines[0]||'').slice(0,60), price:pm?.[1]||'?', link:link.slice(0,80) };
        });
      }).catch(()=>[]);
      console.log(`  ✅ ${u.replace("https://www.bnn.in.th","")} — "${title.slice(0,50)}"`);
      items.forEach(it => console.log(`     ฿${it.price} "${it.name}" → ${it.link.slice(0,50)}`));
      return u; // return first working URL
    } else {
      console.log(`  ❌ ${u.replace("https://www.bnn.in.th","")}`);
    }
  }
  return null;
}

// MacBook Air
await tryUrls("MacBook Air M4", [
  "https://www.bnn.in.th/p/apple/apple-mac/macbook-air",
  "https://www.bnn.in.th/p/apple/apple-mac/macbook-air-m4",
  "https://www.bnn.in.th/p/apple/apple-mac",
]);

// Samsung Galaxy S25
await tryUrls("Samsung Galaxy S25", [
  "https://www.bnn.in.th/p/smartphone-and-accessories/samsung/galaxy-s25",
  "https://www.bnn.in.th/p/smartphone-and-accessories/samsung/galaxy-s-series",
  "https://www.bnn.in.th/p/smartphone-and-accessories/samsung/samsung-galaxy-s",
  "https://www.bnn.in.th/p/smartphone-and-accessories/samsung/samsung-galaxy-s25",
  "https://www.bnn.in.th/p/smartphone-and-accessories/samsung/galaxy-s-series/galaxy-s25",
]);

// ASUS ROG
await tryUrls("ASUS ROG G14", [
  "https://www.bnn.in.th/p/notebook/asus",
  "https://www.bnn.in.th/p/notebook/asus/asus-rog",
  "https://www.bnn.in.th/p/notebook/asus/asus-rog-g14",
  "https://www.bnn.in.th/p/notebook/asus/asus-rog-zephyrus",
  "https://www.bnn.in.th/p/notebook/asus/asus-gaming",
]);

// iPad Air M3
await tryUrls("iPad Air M3", [
  "https://www.bnn.in.th/p/apple/apple-ipad/ipad-air",
  "https://www.bnn.in.th/p/apple/apple-ipad/ipad-air-m3",
  "https://www.bnn.in.th/p/apple/apple-ipad",
]);

// Sony WH-1000XM5 deeper path
await tryUrls("Sony WH-1000XM5", [
  "https://www.bnn.in.th/p/audio-and-headphone/sony/sony-wh-1000xm5",
  "https://www.bnn.in.th/p/audio/sony/sony-headphone",
  "https://www.bnn.in.th/p/audio/sony/sony-wh",
  "https://www.bnn.in.th/p/audio/sony/sony-wh-1000xm5",
]);

await ctx.close();
await browser.close();
console.log("\n✅ Done");
