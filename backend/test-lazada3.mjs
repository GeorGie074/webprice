import { chromium } from 'playwright';

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

  // Capture the Lazada AJAX catalog API
  let apiData = null;
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('lazada.co.th/catalog') && url.includes('ajax=true')) {
      try { apiData = await resp.json(); } catch {}
    }
  });

  await page.goto('https://www.lazada.co.th/catalog/?q=iphone+15+pro+max', {
    waitUntil: 'domcontentloaded', timeout: 30000,
  });
  await page.waitForTimeout(4000);

  // API extraction
  if (apiData) {
    const items = apiData?.mods?.listItems || [];
    console.log('API items:', items.length);
    if (items.length > 0) {
      const first = items[0];
      console.log('First item keys:', Object.keys(first).join(', '));
      console.log('Name:', first.name);
      console.log('Price:', first.price);
      console.log('URL:', first.productUrl);
      console.log('Rating:', first.ratingScore);
    }
  }

  // DOM extraction from [data-tracking="product-card"]
  const domItems = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[data-tracking="product-card"]')).slice(0, 5);
    return cards.map(card => {
      // Try multiple selectors for name
      const name =
        card.querySelector('.RfADt a')?.getAttribute('title') ||
        card.querySelector('[class*="title"]')?.textContent?.trim() ||
        card.querySelector('a[title]')?.getAttribute('title') ||
        card.querySelector('a')?.textContent?.trim() || '';

      // Try multiple selectors for price
      const priceText =
        card.querySelector('.ooOxS')?.textContent?.trim() ||
        card.querySelector('[class*="price"]')?.textContent?.trim() || '';

      // Link
      const href = card.querySelector('a')?.href || '';

      // Rating
      const rating = card.querySelector('[class*="rating"]')?.textContent?.trim() || '';

      return { name: name.slice(0, 60), priceText, href: href.slice(0, 80), rating };
    });
  });

  console.log('\nDOM items:');
  domItems.forEach((item, i) => console.log(`[${i+1}]`, JSON.stringify(item)));

  await browser.close();
})();
