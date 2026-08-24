// Simulate exactly what the backend scraper does
import { chromium } from 'playwright';

const KEYWORD_TH = 'ไอโฟน 15 โปร แมกซ์ 256GB';
const ORIGINAL_PRICE = 52900;

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9฀-๿]/g, ' ').split(/\s+/).filter(Boolean);
}
function bestMatch(items, productName, existingPrice) {
  if (!items.length) return null;
  const keywords = normalize(productName);
  const minScore = Math.ceil(keywords.length * 0.4);
  const mustMatch = keywords[0];
  const sane = items.filter(i => i.price > existingPrice * 0.3 && i.price < existingPrice * 2.5);
  const pool = sane.length > 0 ? sane : items;
  const scored = pool.map(i => {
    const words = normalize(i.name);
    const score = keywords.filter(k => words.some(w => w.length >= 3 && (w.includes(k) || k.includes(w)))).length;
    const hasMustMatch = words.some(w => w === mustMatch || w.includes(mustMatch));
    return { item: i, score, hasMustMatch };
  })
  .filter(c => c.score >= minScore && c.hasMustMatch)
  .sort((a, b) => b.score - a.score || a.item.price - b.item.price);
  return scored[0]?.item || null;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'th-TH', timezoneId: 'Asia/Bangkok', viewport: { width: 1366, height: 768 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });

  const page = await context.newPage();
  let allItems = [];

  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('lazada.co.th/catalog') && url.includes('ajax=true')) {
      try {
        const data = await resp.json();
        const items = data?.mods?.listItems || [];
        if (items.length > 0) {
          allItems = items;
          console.log(`✅ Captured ${items.length} items from Lazada API`);
        }
      } catch {}
    }
  });

  console.log('1. Visiting homepage...');
  await page.goto('https://www.lazada.co.th/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1500);

  console.log(`2. Searching: "${KEYWORD_TH}"`);
  await page.goto(`https://www.lazada.co.th/catalog/?q=${encodeURIComponent(KEYWORD_TH)}&sort=popularity`, {
    waitUntil: 'domcontentloaded', timeout: 25000,
  });
  for (let y = 0; y <= 1200; y += 300) {
    await page.evaluate((sy) => window.scrollTo(0, sy), y);
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(2000);

  const domCount = await page.$$eval('[data-tracking="product-card"]', els => els.length);
  console.log(`DOM cards: ${domCount} | API items: ${allItems.length}`);

  // Try matching
  if (allItems.length > 0) {
    console.log('\nTop 5 from API:');
    allItems.slice(0, 5).forEach((item, i) => console.log(`  [${i+1}] ฿${item.price} | ${item.name?.slice(0, 60)}`));

    const match = bestMatch(allItems.map(i => ({ name: i.name, price: i.price, url: i.itemUrl || '' })), 'iPhone 15 Pro Max 256GB', ORIGINAL_PRICE);
    console.log('\nBest match (English):', match ? `"${match.name}" ฿${match.price}` : 'NONE');
  }

  await browser.close();
  console.log('Done');
})();
