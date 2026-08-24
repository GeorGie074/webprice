import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { writeFileSync } from 'fs';

chromium.use(StealthPlugin());

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'th-TH', timezoneId: 'Asia/Bangkok', viewport: { width: 1366, height: 768 },
  });
  const page = await context.newPage();

  await page.goto('https://shopee.co.th/', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(2000);

  await page.goto('https://shopee.co.th/search?keyword=iphone+15+pro+max', {
    waitUntil: 'domcontentloaded', timeout: 25000,
  });
  await page.waitForTimeout(8000); // wait longer

  const ss = await page.screenshot({ type: 'jpeg', quality: 70 });
  writeFileSync('D:/webprice-new/shopee-search.jpg', ss);
  console.log('Screenshot saved');
  console.log('URL:', page.url().slice(0, 90));
  console.log('Title:', await page.title());

  await browser.close();
})();
