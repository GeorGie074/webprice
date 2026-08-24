import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 50 }); // visible for anti-bot
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'th-TH', timezoneId: 'Asia/Bangkok', viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  let capturedItems = [];
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('lazada.co.th/catalog') && url.includes('ajax=true')) {
      try {
        const data = await resp.json();
        const items = data?.mods?.listItems || [];
        if (items.length > 0) {
          capturedItems = items;
          console.log(`✅ Captured ${items.length} items from Lazada API!`);
          const first = items[0];
          console.log('Name:', first.name);
          console.log('Price:', first.price);
          console.log('URL:', first.productUrl);
          console.log('Rating:', first.ratingScore, '| Reviews:', first.review);
        }
      } catch {}
    }
  });

  console.log('Opening Lazada (visible browser)...');
  await page.goto('https://www.lazada.co.th/catalog/?q=iphone+15+pro+max&sort=popularity', {
    waitUntil: 'domcontentloaded', timeout: 30000,
  });
  await page.waitForTimeout(5000);

  if (capturedItems.length === 0) {
    console.log('No API data — trying DOM...');
    const domCount = await page.$$eval('[data-tracking="product-card"]', els => els.length);
    console.log('DOM product cards:', domCount);

    const domItems = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-tracking="product-card"]')).slice(0, 3).map(card => ({
        text: card.innerText?.slice(0, 100),
      }))
    );
    console.log('DOM items:', JSON.stringify(domItems));
  }

  await browser.close();
  console.log('Done. capturedItems:', capturedItems.length);
})();
