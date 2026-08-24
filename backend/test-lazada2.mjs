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

  // Log ALL JSON API responses
  const allApis = [];
  page.on('response', async (resp) => {
    const url = resp.url();
    const ct = resp.headers()['content-type'] || '';
    if (url.includes('lazada') && ct.includes('json')) {
      try {
        const data = await resp.json();
        const str = JSON.stringify(data);
        // Look for anything with price-like data
        if (str.includes('price') || str.includes('item') || str.includes('product')) {
          allApis.push({ url: url.slice(0, 100), keys: Object.keys(data).slice(0, 5) });
        }
      } catch {}
    }
  });

  await page.goto('https://www.lazada.co.th/catalog/?q=iphone+15+pro+max', {
    waitUntil: 'domcontentloaded', timeout: 30000,
  });

  // Scroll to trigger lazy loading
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(3000);

  console.log('All JSON APIs captured:', allApis.length);
  allApis.forEach(a => console.log(' -', a.url, '| keys:', a.keys.join(',')));

  // Try to extract embedded __NUXT_DATA__ or window data
  const embedded = await page.evaluate(() => {
    // Lazada sometimes embeds data in window.__INITIAL_DATA__ or similar
    const keys = Object.keys(window).filter(k =>
      k.includes('DATA') || k.includes('STATE') || k.includes('APP') || k.includes('INITIAL')
    );
    return keys.slice(0, 5);
  });
  console.log('Window data keys:', embedded);

  // Try different product card selectors
  const selectorResults = await page.evaluate(() => {
    const selectors = [
      '[data-tracking="product-card"]',
      '.Bm3ON', '.c2prKC', '.item--ZHH3t',
      '[class*="gridItem"]', '[class*="item"]',
      'div[class*="card"] a[href*="/products/"]',
      'a[class*="product"]',
      '[data-qa-locator="product-item"]',
    ];
    return selectors.map(sel => ({
      sel,
      count: document.querySelectorAll(sel).length,
    })).filter(r => r.count > 0);
  });
  console.log('Matching selectors:', JSON.stringify(selectorResults));

  // Get all links that look like product pages
  const productLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map(a => a.href)
      .filter(h => h.includes('/products/') || h.includes('lazada.co.th/') && h.split('/').length > 4);
    return [...new Set(links)].slice(0, 5);
  });
  console.log('Product-like links:', productLinks);

  await browser.close();
})();
