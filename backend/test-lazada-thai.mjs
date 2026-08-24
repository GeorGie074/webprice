import { chromium } from 'playwright';

const KEYWORD = 'ไอโฟน 15 โปร แมกซ์';

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
        if (items.length > 0) allItems = items;
      } catch {}
    }
  });

  await page.goto('https://www.lazada.co.th/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1500);

  await page.goto(`https://www.lazada.co.th/catalog/?q=${encodeURIComponent(KEYWORD)}&sort=popularity`, {
    waitUntil: 'domcontentloaded', timeout: 25000,
  });
  for (let y = 0; y <= 1200; y += 300) {
    await page.evaluate((sy) => window.scrollTo(0, sy), y);
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(2000);

  console.log(`Results for "${KEYWORD}": ${allItems.length} items`);
  allItems.slice(0, 10).forEach((item, i) => {
    console.log(`[${i+1}] ฿${item.price} | ${item.name?.slice(0, 70)}`);
  });

  await browser.close();
})();
