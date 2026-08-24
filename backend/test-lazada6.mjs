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

  // Step 1: Visit homepage first to get cookies
  console.log('1. Visiting Lazada homepage...');
  await page.goto('https://www.lazada.co.th/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);
  console.log('   Homepage title:', await page.title());

  // Step 2: Now search
  let capturedItems = [];
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('lazada.co.th/catalog') && url.includes('ajax=true')) {
      try {
        const data = await resp.json();
        const items = data?.mods?.listItems || [];
        if (items.length > 0) capturedItems = items;
      } catch {}
    }
  });

  console.log('2. Searching for iPhone 15 Pro Max...');
  await page.goto('https://www.lazada.co.th/catalog/?q=iphone+15+pro+max&sort=popularity', {
    waitUntil: 'domcontentloaded', timeout: 20000,
  });

  // Simulate human scrolling
  for (let y = 0; y <= 1500; y += 200) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(3000);

  // Check results
  console.log('API items captured:', capturedItems.length);
  if (capturedItems.length > 0) {
    const first = capturedItems[0];
    console.log('✅ SUCCESS! First item:');
    console.log('  Name:', first.name);
    console.log('  Price:', first.price);
    console.log('  URL:', first.productUrl?.slice(0, 80));
    console.log('  Rating:', first.ratingScore);
  }

  const domCount = await page.$$eval('[data-tracking="product-card"], .Bm3ON', els => els.length);
  console.log('DOM product cards:', domCount);

  if (domCount > 0) {
    const domItems = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-tracking="product-card"]')).slice(0, 3).map(card => {
        // Get all text content
        const text = card.innerText?.slice(0, 150);
        const link = card.querySelector('a')?.href || '';
        return { text, link: link.slice(0, 80) };
      })
    );
    console.log('DOM items sample:', JSON.stringify(domItems[0]));
  }

  await browser.close();
})();
