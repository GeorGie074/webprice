// Quick test: open Shopee search and save screenshot to see what the bot-detected page looks like
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    viewport: { width: 1366, height: 768 },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });

  const page = await context.newPage();

  const apiResults = [];
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('search_items') || url.includes('search/search')) {
      try {
        const data = await resp.json();
        const items = data?.items || [];
        if (items.length > 0) {
          apiResults.push({ url, count: items.length, first: items[0]?.item_basic?.name });
        }
      } catch {}
    }
  });

  console.log('Navigating to Shopee...');
  await page.goto('https://shopee.co.th/search?keyword=iphone+15+pro+max', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  await page.waitForTimeout(5000);

  const title = await page.title();
  const url = page.url();
  console.log('Title:', title);
  console.log('URL:', url);
  console.log('API results captured:', apiResults.length);
  if (apiResults.length > 0) {
    console.log('First item:', JSON.stringify(apiResults[0]));
  }

  // Check what's in the DOM
  const productCount = await page.$$eval(
    '[data-sqe="item"], [class*="shopee-search-item-result__item"]',
    els => els.length
  );
  console.log('Product cards in DOM:', productCount);

  // Get page text snippet
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 300));
  console.log('Body text:', bodyText);

  const screenshot = await page.screenshot({ type: 'jpeg', quality: 50 });
  writeFileSync('D:/webprice-new/shopee-test.jpg', screenshot);
  console.log('Screenshot saved to D:/webprice-new/shopee-test.jpg');

  await browser.close();
})();
