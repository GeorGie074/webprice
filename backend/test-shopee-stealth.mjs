import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: {
      'accept-language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  const page = await context.newPage();
  const apiItems = [];

  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('shopee.co.th') && url.includes('search_items')) {
      try {
        const data = await resp.json();
        const items = data?.items ?? [];
        if (items.length > 0) {
          console.log(`✅ Shopee API captured ${items.length} items!`);
          items.slice(0, 5).forEach((item, i) => {
            const b = item.item_basic ?? item;
            console.log(`  [${i+1}] ฿${Math.round((b.price||0)/100000)} | ${(b.name||'').slice(0,60)}`);
          });
          apiItems.push(...items);
        }
      } catch {}
    }
  });

  // Step 1: Visit homepage
  console.log('1. Visiting Shopee homepage...');
  await page.goto('https://shopee.co.th/', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(2000);
  console.log('   Title:', await page.title());
  console.log('   URL:', page.url().slice(0, 70));

  // Step 2: Search
  console.log('2. Searching for iPhone 15 Pro Max...');
  await page.goto('https://shopee.co.th/search?keyword=iphone+15+pro+max&sortBy=pop', {
    waitUntil: 'domcontentloaded', timeout: 25000,
  });
  console.log('   URL after search:', page.url().slice(0, 80));

  // Scroll like a human
  for (let y = 0; y <= 1200; y += 300) {
    await page.evaluate((sy) => window.scrollTo(0, sy), y);
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(2000);

  const bodySnippet = await page.evaluate(() => document.body.innerText.slice(0, 200));
  console.log('   Body:', bodySnippet.replace(/\n/g, ' ').slice(0, 100));
  console.log('   API items captured:', apiItems.length);

  await browser.close();
  console.log(apiItems.length > 0 ? '🎉 SUCCESS!' : '❌ Still blocked');
})();
