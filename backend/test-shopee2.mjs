import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'th-TH', timezoneId: 'Asia/Bangkok', viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: { 'accept-language': 'th-TH,th;q=0.9,en-US;q=0.8' },
  });

  const page = await context.newPage();
  const apiItems = [];

  // Log ALL Shopee JSON responses to find the right endpoint
  page.on('response', async (resp) => {
    const url = resp.url();
    if (!url.includes('shopee.co.th')) return;
    const ct = resp.headers()['content-type'] || '';
    if (!ct.includes('json')) return;
    try {
      const data = await resp.json();
      const str = JSON.stringify(data);
      if (str.includes('"price"') && str.includes('"name"') && str.length > 500) {
        console.log('📦 JSON from:', url.slice(30, 100));
        // Check for search items
        const items = data?.items ?? data?.data?.items ?? [];
        if (items.length > 0) {
          console.log(`  ✅ ${items.length} items!`);
          items.slice(0, 3).forEach((item, i) => {
            const b = item.item_basic ?? item;
            console.log(`  [${i+1}] ฿${Math.round((b.price||0)/100000)} | ${(b.name||'').slice(0, 55)}`);
          });
          apiItems.push(...items);
        }
      }
    } catch {}
  });

  // Visit homepage first
  await page.goto('https://shopee.co.th/', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(2500);

  // Search
  console.log('Searching...');
  await page.goto('https://shopee.co.th/search?keyword=iphone+15+pro+max&sortBy=pop', {
    waitUntil: 'domcontentloaded', timeout: 25000,
  });

  // Wait for products or timeout
  try {
    await page.waitForSelector('[data-sqe="item"]', { timeout: 12000 });
    console.log('Product cards appeared!');
  } catch {
    console.log('Timeout waiting for product cards');
  }

  // Scroll
  for (let y = 0; y <= 2000; y += 400) {
    await page.evaluate((sy) => window.scrollTo(0, sy), y);
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(3000);

  // Check DOM
  const domCards = await page.$$eval('[data-sqe="item"]', els => els.length).catch(() => 0);
  const domCards2 = await page.$$eval('[class*="col-xs-2-4"]', els => els.length).catch(() => 0);
  console.log(`\nDOM: data-sqe="item" → ${domCards} | col-xs-2-4 → ${domCards2}`);
  console.log('API items total:', apiItems.length);

  // Try DOM extraction if API didn't work
  if (domCards > 0 || domCards2 > 0) {
    const items = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-sqe="item"], [class*="col-xs-2-4"]')).slice(0, 5);
      return cards.map(c => ({
        text: c.innerText?.slice(0, 120),
        link: c.querySelector('a')?.href?.slice(0, 80),
      }));
    });
    console.log('\nDOM items:');
    items.forEach((item, i) => console.log(`[${i+1}]`, item.text?.replace(/\n/g, ' ').slice(0, 80)));
  }

  await browser.close();
})();
