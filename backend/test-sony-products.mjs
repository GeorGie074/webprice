/**
 * Check what products are actually on store.sony.co.th
 * and find if WH-1000XM6 exists anywhere
 */
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Fetch all products via JSON API (Shopify)
let allHandles = [];
let pageNum = 1;
while (true) {
  await page.goto(
    `https://store.sony.co.th/products.json?limit=250&page=${pageNum}`,
    { waitUntil: "domcontentloaded", timeout: 20000 }
  );
  const text = await page.innerText("body");
  let data;
  try { data = JSON.parse(text); } catch { break; }
  if (!data.products || data.products.length === 0) break;

  for (const p of data.products) {
    allHandles.push({ handle: p.handle, title: p.title });
    // Check if any product is audio/headphone related
    if (/wh|xm|headphone|audio|earphone|speaker/i.test(p.handle + p.title)) {
      console.log(`🎧 AUDIO: ${p.title.slice(0,60)} → /products/${p.handle}`);
    }
  }
  console.log(`Page ${pageNum}: ${data.products.length} products (total so far: ${allHandles.length})`);
  if (data.products.length < 250) break;
  pageNum++;
}

console.log(`\n✅ Total products on store.sony.co.th: ${allHandles.length}`);
console.log("\nAll product categories (by handle pattern):");
const cats = {};
allHandles.forEach(p => {
  const cat = p.handle.split("-")[0];
  cats[cat] = (cats[cat] || 0) + 1;
});
Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,20).forEach(([k,v]) =>
  console.log(`  ${k.padEnd(20)} ${v} products`)
);

await browser.close();
