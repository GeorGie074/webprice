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

  let apiData = null;
  page.on('response', async (resp) => {
    const url = resp.url();
    if (!url.includes('lazada.co.th')) return;
    const ct = resp.headers()['content-type'] || '';
    if (!ct.includes('json')) return;
    try {
      const data = await resp.json();
      const str = JSON.stringify(data);
      if (str.includes('listItems') || str.includes('price')) {
        console.log('Captured API:', url.slice(0, 100));
        console.log('Keys:', Object.keys(data).join(', '));
        if (data?.mods?.listItems) {
          apiData = data;
          console.log('listItems count:', data.mods.listItems.length);
          if (data.mods.listItems[0]) {
            const item = data.mods.listItems[0];
            console.log('First item:', JSON.stringify({
              name: item.name,
              price: item.price,
              originalPrice: item.originalPrice,
              productUrl: item.productUrl,
              ratingScore: item.ratingScore,
              review: item.review,
            }));
          }
        }
      }
    } catch {}
  });

  await page.goto('https://www.lazada.co.th/catalog/?q=iphone+15+pro+max', {
    waitUntil: 'domcontentloaded', timeout: 30000,
  });

  // Scroll like a real user
  for (let y = 0; y <= 1200; y += 300) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(800);
  }
  await page.waitForTimeout(2000);

  // DOM extraction
  const domItems = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[data-tracking="product-card"], .Bm3ON')).slice(0, 5);
    return cards.map(card => {
      const allText = card.innerText?.slice(0, 200);
      const links = Array.from(card.querySelectorAll('a')).map(a => a.href).slice(0, 2);
      const priceMatch = allText?.match(/[\d,]+/);
      return { text: allText?.slice(0, 80), price: priceMatch?.[0], links };
    });
  });

  console.log('\nDOM items found:', domItems.length);
  domItems.forEach((item, i) => console.log(`[${i+1}]`, JSON.stringify(item)));

  await browser.close();
})();
